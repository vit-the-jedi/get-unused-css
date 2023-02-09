// These lines make "require" available
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    //Start sending raw DevTools Protocol commands are sent using `client.send()`
    //First off enable the necessary "Domains" for the DevTools commands we care about
    const client = await page.target().createCDPSession();
    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('CSS.enable');

    const inlineStylesheetIndex = new Set();
    client.on('CSS.styleSheetAdded', (stylesheet) => {
        const { header } = stylesheet;
        if (
            header.isInline ||
            header.sourceURL === '' ||
            header.sourceURL.startsWith('blob:')
        ) {
            inlineStylesheetIndex.add(header.styleSheetId);
        }
    });

    //Start tracking CSS coverage
    await client.send('CSS.startRuleUsageTracking');

    await page.goto(`http://localhost:3000`);
    // const content = await page.content();
    // console.log(content);

    const rules = await client.send('CSS.takeCoverageDelta');
    const usedRules = rules.coverage.filter((rule) => {
        return rule.used;
    });

    const slices = [];
    for (const usedRule of usedRules) {
        // console.log(usedRule.styleSheetId)
        if (inlineStylesheetIndex.has(usedRule.styleSheetId)) {
            continue;
        }

        const stylesheet = await client.send('CSS.getStyleSheetText', {
            styleSheetId: usedRule.styleSheetId,
        });

        slices.push(
            stylesheet.text.slice(usedRule.startOffset, usedRule.endOffset)
        );
    }

    console.log(slices.join(''));

    await page.close();
    await browser.close();
})();
