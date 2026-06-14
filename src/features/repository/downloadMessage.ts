import { serializeMessage } from "@/core/erepository/serializeMessage"
import { saveTextFile, YAML } from "@/lib/saveFile"
import type { MessageDefinition } from "@/core/types/types"

/** The YAML download for one standard message definition, named after its identifier. */
export function buildMessageYamlDownload(message: MessageDefinition): {
  filename: string
  content: string
} {
  return {
    filename: `${message.identifier}.yaml`,
    content: serializeMessage(message),
  }
}

/** Trigger a browser download of a message definition as canonical YAML. */
export async function downloadMessageYaml(
  message: MessageDefinition
): Promise<void> {
  await saveTextFile(buildMessageYamlDownload(message), YAML)
}
