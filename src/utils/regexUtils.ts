export function isValidXsdPattern(pattern: string): boolean {
    // XSD pattern always matches the whole string
    if (pattern.startsWith('^') || pattern.endsWith('$')) {
        return false
    }
    try {
        new RegExp(pattern, 'u')
        return true
    } catch {
        return false
    }
}