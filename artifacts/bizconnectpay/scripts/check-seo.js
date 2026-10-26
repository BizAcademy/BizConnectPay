import assert from 'node:assert/strict';
import { publicPages, publicPath, resolvePublicPage, pageMetadata, sitemapXml, robotsText } from '../src-server/seo.js';

const urls = new Set();
const titles = new Set();
const descriptions = new Set();
for (const basePath of ['', '/preview']) {
  for (const id of Object.keys(publicPages)) {
    for (const language of ['fr', 'en']) {
      const pathname = publicPath(id, language, basePath);
      assert.deepEqual(resolvePublicPage(pathname, basePath), { id, language });
      if (pathname !== '/') assert.deepEqual(resolvePublicPage(`${pathname}/`, basePath), { id, language });
      const seo = pageMetadata(id, language, basePath);
      assert.equal(seo.canonical, `https://bizconnectpay.com${pathname}`);
      assert.ok(!seo.canonical.includes('#'));
      assert.ok(seo.title && seo.description && seo.fr && seo.en);
      if (!basePath) {
        assert.ok(!urls.has(seo.canonical), 'Duplicate URL');
        assert.ok(!titles.has(seo.title), 'Duplicate title');
        assert.ok(!descriptions.has(seo.description), 'Duplicate description');
        urls.add(seo.canonical); titles.add(seo.title); descriptions.add(seo.description);
      }
    }
  }
}
for (const pathname of ['/admin', '/admin/login', '/api/subscribe', '/healthz', '/unknown', '/en/unknown']) {
  assert.equal(resolvePublicPage(pathname), null);
}
const sitemap = sitemapXml();
assert.equal((sitemap.match(/<url>/g) || []).length, 16);
for (const url of urls) assert.ok(sitemap.includes(`<loc>${url}</loc>`));
assert.ok(!sitemap.includes('/admin'));
assert.ok(robotsText().includes('Allow: /\n'));
assert.ok(robotsText().includes('Sitemap: https://bizconnectpay.com/sitemap.xml'));
assert.ok(!robotsText().includes('Disallow: /\n'));
assert.equal(robotsText('', true), 'User-agent: *\nDisallow: /\n');
process.stdout.write('SEO : 16 URL publiques FR/EN, métadonnées uniques, sitemap et robots valides.\n');
