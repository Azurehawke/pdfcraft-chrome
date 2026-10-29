// Sends PDF navigations to viewer.html, which hosts PdfCraft's web build.

const VIEWER = chrome.runtime.getURL('viewer.html');
const RULE_ID = 1;

// http(s): a redirect rule, so Chrome never starts its own viewer or a download.
// The original URL goes after '#' so it needs no escaping.
async function installRules() {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: [{
      id: RULE_ID,
      priority: 1,
      action: { type: 'redirect', redirect: { regexSubstitution: VIEWER + '#\\0' } },
      condition: {
        regexFilter: '^https?://[^?#]*\\.pdf(\\?.*)?$',
        isUrlFilterCaseSensitive: false,
        resourceTypes: ['main_frame'],
      },
    }],
  });
}

// Chrome hides file:// pages from the extension until "Allow access to file URLs" is on, and that
// switch is per computer (never synced). Flag it on the toolbar icon so it's easy to spot.
async function checkFileAccess() {
  const allowed = await chrome.extension.isAllowedFileSchemeAccess();
  await chrome.action.setBadgeText({ text: allowed ? '' : '!' });
  await chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
  await chrome.action.setTitle({
    title: allowed
      ? 'PdfCraft Viewer'
      : 'PdfCraft Viewer: local PDFs won\'t open here. Click for the fix.',
  });
}

chrome.action.onClicked.addListener(async () => {
  if (!(await chrome.extension.isAllowedFileSchemeAccess())) {
    chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
  }
});

chrome.runtime.onInstalled.addListener(() => { installRules(); checkFileAccess(); });
chrome.runtime.onStartup.addListener(() => { installRules(); checkFileAccess(); });
checkFileAccess();

// file://: request rules don't see local files, so catch the navigation instead.
// Needs "Allow access to file URLs" on the extension's details page.
chrome.webNavigation.onBeforeNavigate.addListener(
  ({ tabId, frameId, url }) => {
    if (frameId === 0) chrome.tabs.update(tabId, { url: VIEWER + '#' + url });
  },
  { url: [{ schemes: ['file'], pathSuffix: '.pdf' }, { schemes: ['file'], pathSuffix: '.PDF' }] },
);
