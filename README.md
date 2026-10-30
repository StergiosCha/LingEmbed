# LingEmbed

**Embedding linguistic theory into neural representations.**

LingEmbed is a neuro-symbolic project about how the structures of formal linguistics can be written into vector spaces and neural networks, and read back out of them. The structures in scope are categorial-grammar categories, typed λ-terms, pregroup/DisCoCat tensors, dependency trees and AMR graphs.

Project website: https://stergioscha.github.io/LingEmbed/ *(after GitHub Pages is enabled, see below)*

## What the website shows

| Section | What is computed (in the browser) |
|---|---|
| Pipeline | Five analyses of *every student reads a book* (CCG, Montague, DisCoCat, UD, AMR). Each node is placed by classical MDS so that ‖hᵢ − hⱼ‖² = d_tree(i,j), which is the target geometry of a structural probe. The embedding is exact in n−1 dimensions, and the site reports the max error. The result is then passed through a small random-weight tanh encoder, which is illustrative only. |
| Binding | Tensor-product representations: T = Σ fᵢ ⊗ rᵢ, unbinding T·rₖ, with and without orthonormal roles, so that crosstalk can be seen. |
| Theories / Methods | Overview of the frameworks and of the two directions: symbolic→neural (embedding) and neural→symbolic (probing). |

## Structure

```
index.html          # single-page site
assets/style.css    # styling
assets/app.js       # visualisations (vanilla JS, no build step, no dependencies)
GEMINI_PROMPT.md    # prompts for generating hero art / an alternative interactive figure with Gemini
.nojekyll           # serve files as-is on GitHub Pages
```

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000
```

## Deploy on GitHub Pages

1. Push this folder to `main` (commands below).
2. In the repository, go to **Settings → Pages → Build and deployment → Source: Deploy from a branch**, then choose **Branch: `main` / root**.
3. The site will be published at `https://stergioscha.github.io/LingEmbed/`.

```bash
git init
git add .
git commit -m "LingEmbed website"
git branch -M main
git remote add origin https://github.com/StergiosCha/LingEmbed.git
git push -u origin main
```

## Background reading

- Smolensky (1990), Tensor product variable binding. *Artificial Intelligence* 46.
- Montague (1973), The proper treatment of quantification in ordinary English.
- Steedman (2000), *The Syntactic Process*.
- Coecke, Sadrzadeh & Clark (2010), Mathematical foundations for a compositional distributional model of meaning.
- Baroni & Zamparelli (2010), Nouns are vectors, adjectives are matrices. *EMNLP*.
- Banarescu et al. (2013), Abstract Meaning Representation for sembanking.
- Serafini & d'Avila Garcez (2016), Logic Tensor Networks.
- Hewitt & Manning (2019), A structural probe for finding syntax in word representations. *NAACL*.

## License

TODO: choose a license (e.g. MIT for code, CC BY 4.0 for text/figures).
