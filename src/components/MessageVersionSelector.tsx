import type {MessageDefinition} from '../types/types.ts'

function versionLabel(msg: MessageDefinition) {
    return 'V' + msg.identifier.substring(msg.identifier.lastIndexOf('.') + 1)
}

export function MessageVersionSelector({versions, currentMessage}: {
    versions: MessageDefinition[]
    currentMessage: MessageDefinition
}) {
    return (
        <div style={{display: 'flex', gap: '0.4rem', marginBottom: '1rem'}}>
            {versions.map((msg) => (
                <a href={'#' + msg.identifier}
                   key={msg.identifier}
                   style={{
                       padding: '0.2em 0.6em', borderRadius: 4, fontSize: '0.8em',
                       cursor: 'pointer', border: '1px solid #2b5ce6',
                       background: msg === currentMessage ? '#2b5ce6' : 'transparent',
                       color: msg === currentMessage ? '#fff' : '#2b5ce6',
                   }}
                >
                    {versionLabel(msg)}
                </a>
            ))}
        </div>
    )
}
