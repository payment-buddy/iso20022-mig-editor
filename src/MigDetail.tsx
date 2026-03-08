import type {MessageImplementationGuide} from "./types.ts";

export function MigDetail({mig}: { mig: MessageImplementationGuide }) {
    return (
        <div>
            <p><a href="#">← Back</a></p>

            <h2>{mig.name}</h2>
            <div>
                {mig.messageIdentifier}
            </div>
            <div>
                {mig.version}
            </div>

            {mig.description && (
                <p style={{whiteSpace: 'pre-wrap'}}>{mig.description}</p>
            )}
        </div>
    )
}
