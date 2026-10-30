# LingEmbed — Theories Under Pressure

**Embedding Linguistic Frameworks in Neural Models.** A workshop in the ACL 2027 cycle (first edition).

Website: https://stergioscha.github.io/LingEmbed/

LingEmbed asks what happens when a linguistic framework (Categorial Grammar, HPSG, Minimalism, Construction Grammar, Dynamic Syntax, type-theoretic semantics) is built into a neural model as a callable, differentiable component, and whether rival theories can be compared this way.

## Editing the site

Everything is in `index.html`, so to change dates, the venue, the submission link or the committee, edit the relevant section there:

- `#dates`: important dates (currently TBA)
- `#cfp`: submission link, format and page limits
- `#people`: organisers and programme committee

The visualisations are in `assets/app.js` (vanilla JS, no build step). Their numbers are computed live in the browser:
- an exact tree-metric embedding (classical MDS) of six analyses of one sentence
- tensor-product binding and unbinding

## Run locally

```bash
python -m http.server 8000   # then open http://localhost:8000
```

Deployment uses GitHub Pages from `main` / root, with `.nojekyll` included.

## Organisers

Stergios Chatzikyriakidis (University of Crete) · Emmanuele Chersoni (The Hong Kong Polytechnic University)
