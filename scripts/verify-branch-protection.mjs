import process from 'node:process'

const REQUIRED_CONTEXTS = ['quality', 'e2e']

function parseRepository() {
  const arg = process.argv.find((value) => value.startsWith('--repo='))
  const repoValue = arg?.slice('--repo='.length) || process.env.GITHUB_REPOSITORY
  if (!repoValue || !repoValue.includes('/')) return null
  return repoValue
}

function parseBranch() {
  const arg = process.argv.find((value) => value.startsWith('--branch='))
  return arg?.slice('--branch='.length) || 'main'
}

function includesAllRequiredContexts(contexts) {
  const actual = new Set(contexts ?? [])
  return REQUIRED_CONTEXTS.every((required) => actual.has(required))
}

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  const repository = parseRepository()
  const branch = parseBranch()

  if (!token) {
    console.error('Missing GITHUB_TOKEN or GH_TOKEN for GitHub API authentication.')
    process.exit(1)
  }
  if (!repository) {
    console.error('Missing repository. Provide --repo=owner/name or set GITHUB_REPOSITORY.')
    process.exit(1)
  }

  const response = await fetch(
    `https://api.github.com/repos/${repository}/branches/${branch}/protection`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  )

  if (!response.ok) {
    const text = await response.text()
    console.error(`Failed to verify branch protection (${response.status}): ${text}`)
    process.exit(1)
  }

  const protection = await response.json()
  const contexts = protection?.required_status_checks?.contexts ?? []
  const hasRequiredChecks = includesAllRequiredContexts(contexts)
  const requiresReviews =
    Number(protection?.required_pull_request_reviews?.required_approving_review_count ?? 0) >= 1

  if (!hasRequiredChecks || !requiresReviews) {
    console.error('Branch protection verification failed.')
    console.error(`Required contexts present: ${hasRequiredChecks}`)
    console.error(`Review requirement present: ${requiresReviews}`)
    console.error(`Contexts found: ${JSON.stringify(contexts)}`)
    process.exit(1)
  }

  console.log(
    `Branch protection verified for ${repository}@${branch} (contexts: ${contexts.join(', ')})`,
  )
}

main().catch((error) => {
  console.error('Failed to verify branch protection:', error)
  process.exit(1)
})
