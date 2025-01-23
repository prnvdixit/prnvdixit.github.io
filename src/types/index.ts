export interface Note {
  title: string;
  publishDate: Date;
  readingTime: number;
  tags: string[];
  githubLink?: string;
  slug: string;
  content: string;
}