import {useCallback, useRef, useState} from 'react'
import {type ERepository, parseRepository} from "./eRepository.js"

type Status = 'idle' | 'parsing' | 'error'

export function FileUploader({onParsed}: {
    onParsed: (result: ERepository) => void
}) {
    const [status, setStatus] = useState<Status>('idle')
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFile = useCallback(async (file: File) => {
        setStatus('parsing')
        try {
            const result = await parseRepository(file)
            onParsed(result)
            setStatus('idle')
        } catch (err) {
            console.error('Failed to parse eRepository file:', err)
            setStatus('error')
        }
    }, [onParsed])

    return (
        <div>
            <p>
                Download <a href="https://www.iso20022.org/iso20022-repository/e-repository" target="_blank"
                            rel="noopener noreferrer">ISO 20022 eRepository</a> and upload the file here
            </p>
            <input
                ref={inputRef}
                type="file"
                accept=".iso20022,.zip"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f)
                }}
            />
            {status === 'error' && (
                <p style={{color: 'red'}}>
                    Failed to parse file.
                </p>
            )}
        </div>
    )
}