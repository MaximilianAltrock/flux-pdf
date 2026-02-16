import JSZip from 'jszip'
import { PDFDocument, degrees as toDegrees } from 'pdf-lib'
import { WorkflowActionType, isWorkflowActionType } from '@/domains/workspace/domain/workflow.actions'
import { formatFilenamePattern, stripPdfExtension } from '@/shared/utils/filename-pattern'
import { err, ok, type Result } from '@/shared/types/result'
import { makeAppError, type WorkflowErrorCode } from '@/shared/types/errors'
import type { Workflow, WorkflowStep } from '@/shared/types/workflow'

type WorkflowRunPhase = 'loading' | 'applying' | 'saving' | 'zipping'

export interface WorkflowRunProgress {
  phase: WorkflowRunPhase
  fileIndex: number
  totalFiles: number
  fileName: string
}

export interface WorkflowRunFailure {
  fileName: string
  reason: string
}

export interface WorkflowRunResult {
  zipFilename: string
  zipBytes: Uint8Array
  processedFiles: number
  failedFiles: WorkflowRunFailure[]
}

export interface WorkflowRunOptions {
  onProgress?: (progress: WorkflowRunProgress) => void
}

function toSafeFilenameBase(value: string): string {
  const normalized = value.replace(/\.[^.]+$/g, '')
  return (
    normalized
      .replace(/[<>:"/\\|?*]|\p{Cc}/gu, '-')
      .replace(/\s+/g, ' ')
      .trim() || 'document'
  )
}

function normalizeRotation(value: number): number {
  return ((value % 360) + 360) % 360
}

function readStepDegrees(step: WorkflowStep): number {
  const rawDegrees = Number(step.params.degrees)
  if (!Number.isFinite(rawDegrees) || rawDegrees === 0) {
    return 90
  }
  return rawDegrees
}

function applyRotateStep(
  pdfDocument: PDFDocument,
  predicate: (pageNumber: number) => boolean,
  degreesDelta: number,
): void {
  const pages = pdfDocument.getPages()
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]
    if (!page) continue
    const pageNumber = index + 1
    if (!predicate(pageNumber)) continue
    const currentRotation = page.getRotation().angle
    page.setRotation(toDegrees(normalizeRotation(currentRotation + degreesDelta)))
  }
}

function applyWorkflowStep(pdfDocument: PDFDocument, step: WorkflowStep): void {
  if (step.commandType === WorkflowActionType.ROTATE_ALL) {
    applyRotateStep(pdfDocument, () => true, readStepDegrees(step))
    return
  }

  if (step.commandType === WorkflowActionType.ROTATE_EVEN) {
    applyRotateStep(pdfDocument, (pageNumber) => pageNumber % 2 === 0, readStepDegrees(step))
    return
  }

  if (step.commandType === WorkflowActionType.ROTATE_ODD) {
    applyRotateStep(pdfDocument, (pageNumber) => pageNumber % 2 === 1, readStepDegrees(step))
    return
  }

  if (step.commandType === WorkflowActionType.DELETE_FIRST_PAGE) {
    if (pdfDocument.getPageCount() > 0) {
      pdfDocument.removePage(0)
    }
    return
  }

  if (step.commandType === WorkflowActionType.DELETE_LAST_PAGE) {
    const pageCount = pdfDocument.getPageCount()
    if (pageCount > 0) {
      pdfDocument.removePage(pageCount - 1)
    }
    return
  }

  throw new Error(`Unsupported workflow step type: ${step.commandType}`)
}

function validateWorkflow(workflow: Workflow): string | null {
  if (!workflow.steps || workflow.steps.length === 0) {
    return 'Workflow has no steps.'
  }

  for (const step of workflow.steps) {
    if (!isWorkflowActionType(step.commandType)) {
      return `Unsupported step "${step.label}" (${step.commandType}).`
    }
  }

  return null
}

function buildZipFilename(workflowName: string): string {
  const safeBase = formatFilenamePattern('{name}_{date}', {
    originalName: workflowName,
    name: workflowName,
  })
  return `${safeBase}.zip`
}

function buildOutputPdfFilename(fileName: string): string {
  const base = stripPdfExtension(fileName)
  const normalizedBase = toSafeFilenameBase(base)
  const outputBase = formatFilenamePattern('{original_name}_processed', {
    originalName: normalizedBase,
    name: normalizedBase,
  })
  return `${outputBase}.pdf`
}

function createWorkflowError(
  code: WorkflowErrorCode,
  message: string,
  cause?: unknown,
) {
  return makeAppError(code, message, cause)
}

export function useWorkflowRunner() {
  async function runWorkflow(
    workflow: Workflow,
    files: File[],
    options: WorkflowRunOptions = {},
  ): Promise<Result<WorkflowRunResult>> {
    const workflowValidationError = validateWorkflow(workflow)
    if (workflowValidationError) {
      return err(createWorkflowError('WORKFLOW_INVALID', workflowValidationError))
    }

    const pdfFiles = files.filter(
      (file) =>
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf'),
    )

    if (pdfFiles.length === 0) {
      return err(createWorkflowError('WORKFLOW_NO_FILES', 'No PDF files provided for workflow run.'))
    }

    const zip = new JSZip()
    const failures: WorkflowRunFailure[] = []
    let processedFiles = 0

    for (let index = 0; index < pdfFiles.length; index++) {
      const file = pdfFiles[index]
      if (!file) continue

      try {
        options.onProgress?.({
          phase: 'loading',
          fileIndex: index,
          totalFiles: pdfFiles.length,
          fileName: file.name,
        })

        const inputBytes = await file.arrayBuffer()
        const pdfDocument = await PDFDocument.load(inputBytes, { ignoreEncryption: true })

        options.onProgress?.({
          phase: 'applying',
          fileIndex: index,
          totalFiles: pdfFiles.length,
          fileName: file.name,
        })

        for (const step of workflow.steps) {
          applyWorkflowStep(pdfDocument, step)
        }

        if (pdfDocument.getPageCount() === 0) {
          throw new Error('Workflow removed every page from the document.')
        }

        options.onProgress?.({
          phase: 'saving',
          fileIndex: index,
          totalFiles: pdfFiles.length,
          fileName: file.name,
        })

        const outputBytes = await pdfDocument.save({
          useObjectStreams: true,
          addDefaultPage: false,
        })
        const outputFileName = buildOutputPdfFilename(file.name)
        zip.file(outputFileName, outputBytes)
        processedFiles++
      } catch (error) {
        failures.push({
          fileName: file.name,
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (processedFiles === 0) {
      return err(
        createWorkflowError(
          'WORKFLOW_RUN_FAILED',
          failures[0]?.reason ?? 'Workflow run failed for all files.',
        ),
      )
    }

    options.onProgress?.({
      phase: 'zipping',
      fileIndex: processedFiles - 1,
      totalFiles: pdfFiles.length,
      fileName: workflow.name,
    })

    const zipBytes = await zip.generateAsync({ type: 'uint8array' })
    return ok({
      zipFilename: buildZipFilename(workflow.name),
      zipBytes,
      processedFiles,
      failedFiles: failures,
    })
  }

  function downloadWorkflowRun(result: WorkflowRunResult): void {
    const safeBuffer = new ArrayBuffer(result.zipBytes.byteLength)
    new Uint8Array(safeBuffer).set(result.zipBytes)
    const blob = new Blob([safeBuffer], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = result.zipFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 5_000)
  }

  return {
    runWorkflow,
    downloadWorkflowRun,
  }
}

