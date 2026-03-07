import type {BusinessArea} from './eRepository.ts'

export function BusinessAreaList({businessAreas}: {businessAreas: BusinessArea[]}) {
    return (
        <ul style={{listStyle: 'none', paddingLeft: 0}}>
            {businessAreas.map((ba) => (
                <li key={ba.code}>
                    <h4><a href={'#' + ba.code}>{ba.name} <code style={{
                        marginLeft: '0.2rem',
                        background: '#eee', color: '#333',
                        padding: '0.1em 0.4em', borderRadius: 3, fontSize: '1em',
                    }}>{ba.code}</code></a></h4>
                    <p>{ba.definition}</p>
                </li>
            ))}
        </ul>
    )
}