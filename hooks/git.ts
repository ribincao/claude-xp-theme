export type GitSummary = { branch: string; staged: number; modified: number; untracked: number; conflicts: number; ahead: number; behind: number; available: boolean }
export const unavailable = (): GitSummary => ({branch:'Unavailable',staged:0,modified:0,untracked:0,conflicts:0,ahead:0,behind:0,available:false})
export function parseGitStatus(stdout: string): GitSummary {
  const result = {...unavailable(), available:true, branch:'Detached HEAD'}
  for (const line of stdout.split('\n')) {
    if (line.startsWith('# branch.head ')) result.branch = line.slice(14) === '(detached)' ? 'Detached HEAD' : line.slice(14)
    else if (line.startsWith('# branch.ab ')) {const m=line.match(/\+(\d+) -(\d+)/);if(m){result.ahead=Number(m[1]);result.behind=Number(m[2])}}
    else if (line.startsWith('1 ') || line.startsWith('2 ')) {if(line[2]!=='.')result.staged++;if(line[3]!=='.')result.modified++}
    else if (line.startsWith('? ')) result.untracked++
    else if (line.startsWith('u ')) result.conflicts++
  }
  return result
}
