# Rahul Jain — Portfolio

Personal site built with [Astro](https://astro.build), including writing, research, and experience pages plus semantic site search.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
npm run test     # run vitest suite
```

## Branches & deploys

- `main` — production site, deployed to the repo's GitHub Pages root.
- `portfolio-site` — working/dev branch, deployed alongside prod under `/dev` as a preview.

Pushing to either branch triggers `.github/workflows/deploy-portfolio.yml`, which builds both and publishes them together via GitHub Pages.

See `HOW_TO_ADD_A_POST.md` for adding writing posts and `TESTING.md` for the search test suite.
