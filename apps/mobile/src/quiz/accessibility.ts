export function quizOptionAnnouncement(
  text: string,
  isCorrect: boolean,
  isChosen: boolean,
  showFeedback: boolean,
  correctLabel: string,
  wrongLabel: string,
  correctAnswerLabel: string,
): string {
  if (!showFeedback) return text;
  if (isChosen) return `${text}. ${isCorrect ? correctLabel : wrongLabel}`;
  return isCorrect ? `${text}. ${correctAnswerLabel}` : text;
}
