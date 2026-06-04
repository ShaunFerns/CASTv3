# CAST – Curriculum Analysis & Structuring Tool

## Overview

CAST is a curriculum analysis and structuring tool designed to help academic teams interrogate, organise, and interpret module and programme documentation in more useful ways. It brings together a set of practical analytical tools that support structured professional judgement around curriculum coherence, subject area requirements, free electives, and module similarity.

The tool is intended to add value to curriculum data rather than simply display it. It supports evidence-informed discussion about what a curriculum appears to be doing, where duplication or fragmentation may exist, how modules group together, and how a portfolio might be made more coherent, navigable, and strategically useful.

CAST is particularly useful in contexts where programme and module documentation is uneven in quality, difficult to navigate at scale, or insufficiently structured for effective academic review and planning.

---

## What CAST Does

CAST currently includes three main areas of functionality:

### 1. SARs
The SARs area supports analysis and structuring work around Subject Area Requirements. It helps identify and classify modules that may contribute to broad curriculum requirement areas and supports discussion about how these requirements can be organised in a way that is academically coherent and operationally usable.

### 2. Free Electives
The Free Electives area supports the review and grouping of modules that may be suitable for elective use beyond their home discipline or programme. It is intended to support clearer thinking about breadth, accessibility, disciplinary families, and elective portfolio design.

### 3. Structure Explorer
The Structure Explorer analyses relationships between modules, primarily through their learning outcomes, in order to identify overlap, clusters, outliers, and broader patterns across a curriculum. It is designed to help programme teams explore the shape of a curriculum as documented and to support evidence-informed curriculum conversations.

These areas are connected by a common aim: to help academic teams work more intelligently with module data and documentation.

---

## Why CAST Exists

In many institutional settings, module and programme documentation is asked to do a great deal of work. It is expected to communicate curriculum intent, support quality assurance, inform students, assist reviewers, and enable strategic planning. In reality, that documentation is often partial, inconsistent, difficult to compare, or overly shaped by local wording habits.

CAST exists to provide a more analytical layer over that documentation.

It helps teams ask questions such as:

- What does the curriculum actually look like when viewed as a whole?
- Which modules appear to overlap strongly?
- Which modules are isolated or weakly connected?
- Are there hidden thematic groupings across the portfolio?
- Which modules might be suitable as free electives?
- How might Subject Area Requirements be populated more coherently?
- Where does the documented curriculum appear stronger or weaker than expected?

CAST does not replace academic judgement. It provides structured evidence and visualisations to support it.

---

## Core Design Principles

CAST is being developed around a number of core principles:

- build incrementally and modularly
- support interpretability rather than black-box outputs
- foreground academic judgement
- make complex curriculum structures more visible
- work with imperfect institutional data
- remain scalable to much larger datasets
- support future extension without needing redesign

The tool is intended to be both practically useful and analytically defensible.

---

## Main Functional Areas

## SARs

The SARs area is concerned with identifying and organising modules that may contribute to defined Subject Area Requirements.

This part of the tool is useful where a curriculum includes broad requirement categories that cut across programmes or disciplines and where teams need to decide:

- which modules belong in which requirement area
- whether there is adequate spread across the requirement categories
- whether modules are genuinely suitable for the role proposed
- whether the portfolio appears balanced or underdeveloped in particular areas

The SARs area is intended to assist structured academic review rather than to produce final automated decisions. It can help surface candidate modules, organise them more systematically, and support better portfolio-level conversations.

## Free Electives

The Free Electives area is concerned with identifying and grouping modules that may be appropriate for elective uptake beyond their home discipline.

This part of the tool can help with questions such as:

- which modules are likely to travel well beyond their home programme
- how elective offerings can be grouped into broad discipline families
- where there may be barriers to elective suitability
- whether the elective offer appears coherent, accessible, and balanced
- how a large portfolio might be structured more clearly for advising and planning

This is especially useful where institutions want students to have meaningful breadth and choice, but where the underlying module catalogue is too large or too unevenly documented to make those choices easy to structure.

## Structure Explorer

The Structure Explorer analyses module relationships and curriculum shape through module learning outcomes and related module text.

It is designed to support questions such as:

- which modules appear very similar
- are there clusters of modules suggesting hidden or explicit themes
- which modules look like outliers
- where might documentation suggest duplication
- where might conceptual overlap exist even when wording differs
- how coherent does a curriculum appear as documented

This area of CAST is now the most analytically developed and includes both lexical and semantic similarity analysis.

---

## Structure Explorer: Similarity Methods

Structure Explorer currently supports two complementary similarity methods, plus a comparison mode.

### 1. TF-IDF Similarity

The original Structure Explorer uses **TF-IDF cosine similarity** on module learning outcomes.

This method:

- converts module learning outcomes into weighted term vectors
- gives more importance to words that are distinctive across the portfolio
- compares modules using cosine similarity

This is a **lexical** similarity method. It is very useful for identifying:

- repeated or near-repeated language
- similar documented phrasing
- vocabulary-driven clusters
- possible duplication in module descriptions
- outliers with unusual wording

It is fast, transparent, and locally computed.

### 2. Semantic Similarity

Structure Explorer now also supports **semantic similarity** based on embeddings.

This method:

- generates embeddings from module learning outcomes using the existing OpenAI integration
- stores those embeddings for reuse
- normalises and caches them in memory for analysis
- computes cosine similarity locally after embeddings are generated

This is a **meaning-oriented** similarity method. It is useful for identifying:

- conceptual overlap expressed in different wording
- hidden relationships between modules
- thematic proximity not obvious from shared vocabulary
- deeper curriculum structure across a portfolio

Embedding generation uses the OpenAI embeddings API in the background. Once embeddings are created, similarity analysis, clustering, network generation, and related calculations run locally.

### 3. Compare Both

Structure Explorer also includes a **Compare Both** mode.

This allows users to compare lexical and semantic similarity side by side and identify cases such as:

- **Strong match**: similar wording and similar meaning
- **Hidden overlap**: different wording but similar meaning
- **Shared language**: similar wording but weaker conceptual similarity
- **Distinct module**: little overlap in either method

This comparison mode is particularly useful in institutional contexts where module documentation quality varies and where language alone may not tell the full story of curriculum structure.

---

## Structure Explorer: Main Views

Structure Explorer includes five main tabs or views.

### Overview
Provides high-level metrics and summary information about the analysed portfolio, including coverage and method-specific readiness.

### Similar Modules
Allows a user to inspect the modules most similar to a selected module, using TF-IDF, semantic similarity, or both side by side.

### Clusters
Groups related modules into clusters. These may indicate coherent thematic areas, repeated topics, or areas of possible duplication.

### Outliers
Highlights modules with weak similarity to the rest of the portfolio. These may represent distinct niche modules, weakly integrated modules, or modules with sparse documentation.

### Network
Visualises module relationships as a graph to help users see how the curriculum connects at portfolio level.

---

## Structure Explorer: What Was Recently Added

The current Structure Explorer now includes a substantial semantic layer alongside the original TF-IDF method.

### Backend additions
A parallel semantic analysis engine was added, including:

- embedding loading and normalisation from the database
- in-memory embedding cache using `Float32Array`
- real-time semantic similar-module lookup
- semantic clusters and outliers using the same connected-component logic as TF-IDF
- semantic network generation using dense similarity calculation
- background embedding generation in batches through the existing OpenAI integration
- embedding status tracking for frontend polling

### Frontend additions
The Structure Explorer frontend now includes:

- a method selector for TF-IDF, Semantic, and Compare Both
- concise explanatory text that updates with the selected method
- an embedding generation banner with progress and completion states
- semantic-tab gating when embeddings are not yet available
- side-by-side comparison views
- visual distinctions between both-method matches, semantic-only matches, and TF-IDF-only matches
- explanatory in-browser interpretation support

This means the Structure Explorer now supports both documented-language analysis and conceptual-similarity analysis within the same interface.

---

## How to Interpret CAST Outputs

CAST is designed as an **insight and sense-making tool**, not an automated decision-maker.

Its outputs should always be interpreted in context.

### When reviewing SARs
A module appearing suitable for a requirement area does not mean it should automatically be included. Suitability still depends on intent, level, balance, progression, and local academic judgement.

### When reviewing Free Electives
A module appearing attractive or broadly relevant does not automatically mean it is suitable as an elective. Accessibility, prerequisites, scale, timetabling, and assessment load still matter.

### When reviewing Structure Explorer results
High similarity is not automatically a problem. It may indicate:

- deliberate scaffolding
- disciplinary coherence
- progression
- repeated documentation habits
- genuine duplication

Low similarity is not automatically a strength. It may indicate:

- valuable distinctiveness
- weak programme integration
- sparse or poor documentation
- unusual module purpose
- hidden conceptual connections missed by one method but not the other

CAST should support academic discussion, not replace it.

---

## Data Basis

CAST works with the module data and documentation made available to it. This may include:

- module titles
- learning outcomes
- module descriptions
- other structured or semi-structured module metadata

The Structure Explorer currently relies primarily on **module learning outcomes** for similarity analysis.

This matters because output quality depends heavily on input quality. Weak, generic, missing, or inconsistent learning outcomes will affect the analytical usefulness of the results.

One of the strengths of CAST is that it can help make those documentation weaknesses visible rather than quietly ignoring them.

---

## Technical Position

CAST has been developed so that analysis can scale while remaining understandable.

### Current technical characteristics
- preserves existing working workflows
- adds new analytical layers rather than replacing old ones
- performs TF-IDF similarity locally
- generates semantic embeddings once and stores them for reuse
- performs downstream semantic analysis locally after embedding creation
- supports background embedding generation with frontend progress tracking
- is structured to allow future scaling and further analytical extensions

### Current semantic embedding approach
The current semantic layer uses:

- OpenAI embeddings
- `text-embedding-3-small`
- 256 dimensions
- batched background generation
- local cosine similarity for downstream analysis

This is a pragmatic balance between cost, speed, and analytical value.

---

## Relationship Between the Three CAST Areas

Although SARs, Free Electives, and Structure Explorer serve different immediate purposes, they are related.

### SARs
Helps determine how modules may contribute to broad curriculum requirement structures.

### Free Electives
Helps determine how modules may travel across disciplinary or programme boundaries.

### Structure Explorer
Helps reveal the underlying relationships, overlaps, clusters, and distinctiveness across the portfolio itself.

Together, these allow CAST to move beyond simple catalogue browsing into a more analytical mode of curriculum interpretation.

---

## Typical Uses

CAST can support work such as:

- curriculum review
- programme redesign
- subject area requirement planning
- free elective portfolio design
- module duplication review
- curriculum coherence discussions
- advising and planning support
- evidence gathering for internal review
- structured preparation for validation or revalidation
- exploratory portfolio analysis before larger strategic change

---

## Current Position

### Available now
- working SARs area
- working Free Electives area
- Structure Explorer with TF-IDF similarity
- Structure Explorer with semantic similarity
- Compare Both mode
- clustering, outliers, network, and similar-module views
- background embedding generation and progress tracking
- local downstream similarity analysis

### Likely future areas
- larger-scale batch analytics
- more advanced threshold tuning
- richer integration of module metadata
- improved cluster labelling
- stronger cross-programme and cross-portfolio analysis
- additional curriculum mapping and pathway-oriented layers

---

## Practical Summary

CAST is not just a search tool and not just a dashboard. It is a developing curriculum intelligence tool.

Its value lies in helping teams move from isolated module descriptions to a more structured understanding of curriculum shape, overlap, breadth, and coherence. It is especially useful where institutions need to work with large, messy, or uneven documentation and still make defensible academic decisions.

The addition of semantic similarity to Structure Explorer is a significant step in that development. It means CAST can now support both:

- analysis of the **language of the documented curriculum**
- analysis of the **conceptual relationships within the documented curriculum**

That distinction is important, and in many cases analytically powerful.

---

## Short Description

**CAST is a curriculum analysis and structuring tool that supports work on Subject Area Requirements, Free Electives, and curriculum relationship mapping. It helps academic teams interrogate module portfolios through structured analysis of documentation, including lexical and semantic similarity, to support clearer, more evidence-informed curriculum 
