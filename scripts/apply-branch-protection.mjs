import process from 'node:process'

const DEFAULT_REQUIRED_CONTEXTS = ['quality', 'e2e']

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
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        required_status_checks: {
          strict: true,
          contexts: DEFAULT_REQUIRED_CONTEXTS,
        },
        enforce_admins: true,
        required_pull_request_reviews: {
          dismiss_stale_reviews: true,
          require_code_owner_reviews: false,
          required_approving_review_count: 1,
          require_last_push_approval: false,
        },
        restrictions: null,
        required_conversation_resolution: true,
        allow_force_pushes: false,
        allow_deletions: false,
        block_creations: false,
        required_linear_history: true,
      }),
    },
  )

  if (!response.ok) {
    const text = await response.text()
    console.error(`Failed to apply branch protection (${response.status}): ${text}`)
    process.exit(1)
  }

  console.log(
    `Branch protection applied for ${repository}@${branch} with required checks: ${DEFAULT_REQUIRED_CONTEXTS.join(', ')}`,
  )
}

main().catch((error) => {
  console.error('Failed to apply branch protection:', error)
  process.exit(1)
})
