export function slackMrkdwnToHtml(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/<(https?:\/\/[^\|>]+)\|([^>]+)>/g, '<a href="$1">$2</a>')
    .replace(/<(https?:\/\/[^>]+)>/g, '<a href="$1">$1</a>')
    .replace(/```([^`]+)```/g, "<pre>$1</pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*([^*]+)\*/g, "<b>$1</b>")
    .replace(/_([^_]+)_/g, "<i>$1</i>")
    .replace(/~([^~]+)~/g, "<s>$1</s>");
  return html;
}
