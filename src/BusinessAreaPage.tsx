import type {BusinessArea} from './eRepository.ts'

export function BusinessAreaPage({businessArea}: {businessArea: BusinessArea}) {
    return (
        <div>
            <p><a href="#">← Back</a></p>
            <h1>{businessArea.name}</h1>
            <p><strong>Code:</strong> <code>{businessArea.code}</code></p>
            <p>{businessArea.definition}</p>
        </div>
    )
}