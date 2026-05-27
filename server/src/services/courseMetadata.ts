export interface CourseContentSection {
  title: string;
  body: string;
}

export interface CourseSyllabusMetadata {
  fullDescription: string | null;
  category: string | null;
  estimatedDuration: string | null;
  learningObjectives: string[];
  contentSections: CourseContentSection[];
}

export interface CourseSyllabusInput {
  fullDescription?: unknown;
  category?: unknown;
  estimatedDuration?: unknown;
  learningObjectives?: unknown;
  contentSections?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const normalizeInlineText = (value: unknown, maxLength: number): string | null => {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  return normalized ? normalized.slice(0, maxLength) : null;
};

const normalizeBlockText = (value: unknown, maxLength: number): string | null => {
  const normalized = String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  return normalized ? normalized.slice(0, maxLength) : null;
};

const normalizeTextList = (value: unknown, maxItems: number, maxLength: number): string[] => {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split('\n')
      : [];

  const seen = new Set<string>();
  const items: string[] = [];
  for (const entry of source) {
    const normalized = normalizeInlineText(entry, maxLength);
    if (!normalized || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    items.push(normalized);
    if (items.length >= maxItems) break;
  }
  return items;
};

const normalizeContentSections = (value: unknown): CourseContentSection[] => {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split('\n')
      : [];

  const sections: CourseContentSection[] = [];
  source.forEach((entry, index) => {
    let title: string | null = null;
    let body: string | null = null;

    if (isRecord(entry)) {
      title = normalizeInlineText(entry.title, 160);
      body = normalizeBlockText(entry.body || entry.description || entry.content, 3000);
    } else {
      const line = normalizeBlockText(entry, 3160);
      if (!line) return;
      const separatorIndex = line.indexOf(':');
      if (separatorIndex > 0) {
        title = normalizeInlineText(line.slice(0, separatorIndex), 160);
        body = normalizeBlockText(line.slice(separatorIndex + 1), 3000);
      } else {
        title = `Section ${index + 1}`;
        body = line;
      }
    }

    if (!body) return;
    sections.push({
      title: title || `Section ${index + 1}`,
      body,
    });
  });

  return sections.slice(0, 24);
};

export const normalizeCourseSyllabusMetadata = (value: unknown): CourseSyllabusMetadata => {
  if (Array.isArray(value)) {
    return {
      fullDescription: null,
      category: null,
      estimatedDuration: null,
      learningObjectives: [],
      contentSections: normalizeContentSections(value),
    };
  }

  const record = isRecord(value) ? value : {};
  return {
    fullDescription: normalizeBlockText(record.fullDescription || record.body || record.content, 8000),
    category: normalizeInlineText(record.category || record.topic, 120),
    estimatedDuration: normalizeInlineText(record.estimatedDuration || record.duration || record.sessionLength, 120),
    learningObjectives: normalizeTextList(record.learningObjectives || record.objectives || record.outcomes, 24, 240),
    contentSections: normalizeContentSections(record.contentSections || record.sections || record.modules),
  };
};

export const hasCourseSyllabusInput = (input: CourseSyllabusInput): boolean =>
  input.fullDescription !== undefined ||
  input.category !== undefined ||
  input.estimatedDuration !== undefined ||
  input.learningObjectives !== undefined ||
  input.contentSections !== undefined;

export const buildCourseSyllabusMetadata = (
  existing: unknown,
  input: CourseSyllabusInput
): CourseSyllabusMetadata => {
  const current = normalizeCourseSyllabusMetadata(existing);
  return {
    fullDescription:
      input.fullDescription === undefined
        ? current.fullDescription
        : normalizeBlockText(input.fullDescription, 8000),
    category:
      input.category === undefined
        ? current.category
        : normalizeInlineText(input.category, 120),
    estimatedDuration:
      input.estimatedDuration === undefined
        ? current.estimatedDuration
        : normalizeInlineText(input.estimatedDuration, 120),
    learningObjectives:
      input.learningObjectives === undefined
        ? current.learningObjectives
        : normalizeTextList(input.learningObjectives, 24, 240),
    contentSections:
      input.contentSections === undefined
        ? current.contentSections
        : normalizeContentSections(input.contentSections),
  };
};
