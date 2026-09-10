# Math Over Emotion

The hiring market runs on vibes. We think it should run on arithmetic.

## The problem

A job seeker sends 200 applications and hears back on 12. They cannot tell which
of the 188 silences were real rejections, which were roles that never existed,
and which were postings kept open to harvest a resume pipeline. The information
asymmetry is total: the company knows its own numbers and has no reason to share
them.

Every platform built to fix this has been funded by the side with the
information advantage. That is not a coincidence, and it is not fixable by a
better UI.

## Three commitments

**1. Every claim is a number, and every number is checkable.**

A "Ghost Score" is not a badge we award. It is a function of published, signed
facts: how long a posting has been open, how many applications it received, how
many moved to a next stage, how many closed with a hire. If a company will not
publish the inputs, it does not get a score, it gets an absence, and absence is
itself information.

**2. The data outlives the platform.**

Everything lives in Git as plain JSON. Job posts, applications, receipts,
reputation history. If this project is abandoned, acquired, or turns hostile,
the entire network can be forked by anyone with a clone. There is no database to
be held hostage. Migration is `git clone`.

**3. There is no server to compromise.**

The client is a static bundle on GitHub Pages. Reads go straight to the GitHub
API. Writes are commits signed by the user's own credentials. The single
exception is a stateless Cloudflare Worker that verifies payment webhooks and
signs receipts, because Stripe cannot call a static file and a signing key
cannot live in a browser. It stores nothing.

## What follows from this

- **Transparency is priced, not begged for.** Posting a job is paid. Publishing
  your funnel numbers is what the payment buys. Visibility ranks on disclosure.
- **Silence is measured.** The Black Hole Tracker records what companies do not
  do. A non-response is a data point with a timestamp.
- **Receipts, not trust.** Payments and outcomes produce Ed25519-signed receipts
  that any client can verify offline against a published public key.
- **The algorithm is readable.** Scoring runs client-side, in the open, in this
  repository. Disagree with the weights? Read them. Fork them. Send a PR.

## What this is not

Not a network with an engagement feed. Not a recruiter tool with a candidate
funnel. Not a place where paying more buys a better score. Paying buys the
right to be measured.

We are not asking anyone to trust us. We are asking them to check the math.
