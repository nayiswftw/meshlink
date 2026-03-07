export function getAppDisplayName(settings: any): string {
    const base = settings?.displayName || '';
    if (!base) return '';
    if (!settings.deviceId) return base;
    return `${base}::${settings.deviceId}`;
}

export function formatName(rawName: string | undefined | null): string {
    if (!rawName) return '';
    const idx = rawName.lastIndexOf('::');
    if (idx !== -1) return rawName.substring(0, idx);
    return rawName;
}
