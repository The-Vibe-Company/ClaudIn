/**
 * Data Export Utilities
 * Handles exporting profiles to CSV and JSON formats
 */

import type { CRMProfile } from './api';

export type ExportFormat = 'csv' | 'json';

interface ExportOptions {
  filename?: string;
  format: ExportFormat;
}

/**
 * Convert profiles to CSV format
 */
function profilesToCSV(profiles: CRMProfile[]): string {
  const headers = [
    'Name',
    'Public Identifier',
    'Headline',
    'Title',
    'Company',
    'Location',
    'LinkedIn URL',
    'Sync Status',
  ];

  const rows = profiles.map((p) => [
    escapeCsvField(p.fullName),
    escapeCsvField(p.publicIdentifier),
    escapeCsvField(p.headline || ''),
    escapeCsvField(p.currentTitle || ''),
    escapeCsvField(p.currentCompany || ''),
    escapeCsvField(p.location || ''),
    `https://linkedin.com/in/${p.publicIdentifier}`,
    p.isPartial ? 'Partial' : 'Complete',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Escape a field for CSV output
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert profiles to JSON format
 */
function profilesToJSON(profiles: CRMProfile[]): string {
  const exportData = profiles.map((p) => ({
    name: p.fullName,
    publicIdentifier: p.publicIdentifier,
    linkedinUrl: `https://linkedin.com/in/${p.publicIdentifier}`,
    headline: p.headline,
    title: p.currentTitle,
    company: p.currentCompany,
    location: p.location,
    profilePicture: p.profilePictureUrl,
    syncStatus: p.isPartial ? 'partial' : 'complete',
    lastMessage: p.lastMessage
      ? {
          content: p.lastMessage.content,
          date: p.lastMessage.at,
          direction: p.lastMessage.direction,
        }
      : null,
    lastPost: p.lastPost
      ? {
          content: p.lastPost.content,
          date: p.lastPost.at,
        }
      : null,
  }));

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export profiles using browser download
 * This approach works in both Tauri and browser environments
 */
export async function exportProfiles(
  profiles: CRMProfile[],
  options: ExportOptions
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const { format, filename = `claudin-export-${Date.now()}` } = options;

    const extension = format === 'csv' ? 'csv' : 'json';
    const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
    const content = format === 'csv' ? profilesToCSV(profiles) : profilesToJSON(profiles);

    // Create blob and download link
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    // Create temporary download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${extension}`;
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error('Export failed:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Quick export to clipboard
 */
export function copyToClipboard(profiles: CRMProfile[], format: ExportFormat): string {
  return format === 'csv' ? profilesToCSV(profiles) : profilesToJSON(profiles);
}
