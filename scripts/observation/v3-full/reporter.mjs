export default async function* reporter(source) {
  for await (const event of source) {
    if (event.type === 'test:pass' || event.type === 'test:fail') yield `${JSON.stringify(event)}\n`;
  }
}
