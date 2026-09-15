/** Uploaded originals retained for the course author's later preparation. */
export interface CourseSourceMaterial {
  materialId: string;
  originalName: string;
  mime: string;
  bytes: number;
}
