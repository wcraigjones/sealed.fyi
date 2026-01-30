# Phase 2, Stream H: Frontend HTML & CSS

## Goal
Create the static HTML structure and CSS styling for the SPA.

## Files
- `frontend/index.html`
- `frontend/css/style.css`

## Scope
- Semantic HTML structure with view sections (hidden by default)
- Clean, minimal CSS styling
- Mobile responsive
- Accessibility (labels, focus states, ARIA)
- No JavaScript — just structure and style

## HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>sealed.fyi</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <main>
    <header>
      <h1>sealed.fyi</h1>
      <p>Share secrets securely. View once, then gone.</p>
    </header>

    <section id="view-create" class="view">
      <!-- Secret creation form -->
    </section>

    <section id="view-creating" class="view hidden">
      <!-- Loading state during PoW/submission -->
    </section>

    <section id="view-link" class="view hidden">
      <!-- Display generated link -->
    </section>

    <section id="view-reveal" class="view hidden">
      <!-- Click to reveal button -->
    </section>

    <section id="view-passphrase" class="view hidden">
      <!-- Passphrase input for protected secrets -->
    </section>

    <section id="view-secret" class="view hidden">
      <!-- Display decrypted secret -->
    </section>

    <section id="view-error" class="view hidden">
      <!-- Error states -->
    </section>

    <footer>
      <!-- Links, info -->
    </footer>
  </main>

  <script src="js/crypto.js"></script>
  <script src="js/pow.js"></script>
  <script src="js/api.js"></script>
  <script src="js/storage.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

## View Details

### view-create
- Textarea for secret (with character count, max 50KB)
- TTL dropdown (15 min, 1 hr, 1 day, 7 days, 30 days, 90 days)
- Max views dropdown (1, 2, 3, 4, 5)
- Passphrase checkbox + input (shown when checked)
- Create button

### view-creating
- Loading spinner
- "Generating secure link..." message
- Progress indicator for PoW (optional)

### view-link
- Generated URL display (readonly input)
- Copy button
- Warning text: "This link can only be viewed X time(s)"
- Burn link section (if enabled)

### view-reveal
- "Click to Reveal" button (large, prominent)
- Warning: "This secret will be destroyed after viewing"

### view-passphrase
- Passphrase input field
- Reveal button
- Error message area

### view-secret
- Secret content display (pre-formatted)
- Copy button
- "Secret has been destroyed" confirmation

### view-error
- Error icon
- Error message
- "Create new secret" link

## CSS Requirements
- Mobile-first responsive design
- Clean, minimal aesthetic
- Dark text on light background (high contrast)
- Clear visual hierarchy
- Smooth transitions for view changes
- Focus states for accessibility
- Button hover/active states

## Exit Criteria
- [ ] All views implemented in HTML
- [ ] CSS complete and responsive
- [ ] Accessible (labels, ARIA, focus states)
- [ ] Views can be toggled manually to verify layout
- [ ] Code reviewed
