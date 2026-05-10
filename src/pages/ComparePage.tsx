import {useMemo} from 'react'
import {stringify} from 'yaml'
import type {MessageImplementationGuide} from "../types/types.ts"
import {prepareForDownload} from "../utils/migUtils.ts"

type DiffKind = 'unchanged' | 'added' | 'removed'

interface DiffRow {
    kind: DiffKind
    textA: string
    textB: string
}

function computeDiff(linesA: string[], linesB: string[]): DiffRow[] {
    const m = linesA.length
    const n = linesB.length
    const dp: number[][] = Array.from({length: m + 1}, () => new Array(n + 1).fill(0))

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = linesA[i - 1] === linesB[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1])
        }
    }

    const result: DiffRow[] = []
    let i = m, j = n
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
            result.push({kind: 'unchanged', textA: linesA[i - 1], textB: linesB[j - 1]})
            i--
            j--
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result.push({kind: 'added', textA: '', textB: linesB[j - 1]})
            j--
        } else {
            result.push({kind: 'removed', textA: linesA[i - 1], textB: ''})
            i--
        }
    }

    return result.reverse()
}

export function ComparePage({migA, migB}: {
    migA: MessageImplementationGuide
    migB: MessageImplementationGuide
}) {
    const {rows, aName, bName} = useMemo(() => {
        const replacer = (_key: unknown, val: unknown) => {
            if (val === null) return undefined
            if (Array.isArray(val) && val.length === 0) return undefined
            return val
        }
        const yamlA = stringify(prepareForDownload(migA), replacer)
        const yamlB = stringify(prepareForDownload(migB), replacer)
        return {
            rows: computeDiff(yamlA.split('\n'), yamlB.split('\n')),
            aName: `${migA.name}:${migA.version}`,
            bName: `${migB.name}:${migB.version}`,
        }
    }, [migA, migB])

    return (
        <div>
            <a href="#" className="back-link">← Back</a>
            <div className="page-header">
                <h2>Compare MIGs</h2>
            </div>
            <div style={{display: 'flex', gap: '1em', fontFamily: 'monospace', fontSize: '0.85em'}}>
                <div style={{flex: 1}}>
                    <h3 style={{fontFamily: 'initial'}}>{aName}</h3>
                    <pre style={{margin: 0, lineHeight: 1.5}}>{rows.map((row, i) => (
                        <div key={i} style={{
                            backgroundColor: row.kind === 'removed' ? 'rgba(255,0,0,0.12)' : 'transparent',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                        }}>{row.kind === 'removed' ? row.textA : row.textA || ' '}</div>
                    ))}</pre>
                </div>
                <div style={{flex: 1}}>
                    <h3 style={{fontFamily: 'initial'}}>{bName}</h3>
                    <pre style={{margin: 0, lineHeight: 1.5}}>{rows.map((row, i) => (
                        <div key={i} style={{
                            backgroundColor: row.kind === 'added' ? 'rgba(0,200,0,0.12)' : 'transparent',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                        }}>{row.kind === 'added' ? row.textB : row.textB || ' '}</div>
                    ))}</pre>
                </div>
            </div>
        </div>
    )
}
