export function createBrowserLaunchOptions(chromePath) {
  const options = {
    headless: true,
    args: ['--no-sandbox'],
  };
  if (chromePath) options.executablePath = chromePath;
  return options;
}
