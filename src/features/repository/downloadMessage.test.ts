import { describe, expect, it } from "vitest"
import { parse } from "yaml"
import type { MessageDefinition, MessageElement } from "@/core/types/types"
import { buildMessageYamlDownload } from "./downloadMessage"

function message(): MessageDefinition {
  const root: MessageElement = {
    id: "",
    name: "Document",
    xmlTag: "Document",
    isAttribute: false,
    definition: "",
    minOccurs: 1,
    maxOccurs: 1,
    typeId: "",
    type: "",
    baseType: null,
    minInclusive: null,
    maxInclusive: null,
    totalDigits: null,
    fractionDigits: null,
    length: null,
    minLength: null,
    maxLength: null,
    pattern: null,
    baseValue: null,
    codes: [],
    constraints: [],
    examples: [],
    elements: [],
  }
  return {
    name: "FIToFICustomerCreditTransfer",
    identifier: "pacs.008.001.08",
    shortCode: "pacs.008",
    rootElement: root,
  }
}

describe("buildMessageYamlDownload", () => {
  it("names the file after the message identifier", () => {
    expect(buildMessageYamlDownload(message()).filename).toBe(
      "pacs.008.001.08.yaml"
    )
  })

  it("serializes the message as canonical YAML", () => {
    const parsed = parse(buildMessageYamlDownload(message()).content)
    expect(parsed).toMatchObject({
      formatVersion: 1,
      name: "FIToFICustomerCreditTransfer",
      identifier: "pacs.008.001.08",
      shortCode: "pacs.008",
    })
  })
})
