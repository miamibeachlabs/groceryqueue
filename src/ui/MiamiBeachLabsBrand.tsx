export const MiamiBeachLabsBrand = () =>
  <div class="byline">
    <span>by</span>
    <span class="mbl-brand">
      <svg viewBox="0 0 80 80" role="img" aria-label="Miami Beach Labs">
        <defs>
          <linearGradient id="mbl-gradient" x1="0" y1="0" x2="80" y2="80"
            gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#2ab5b5" />
            <stop offset="100%" stop-color="#4ecece" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#mbl-gradient)">
          <path d="M40 8 14 58h52L40 8Z" stroke-width="1.8" opacity=".45" />
          <path d="M40 8v28M14 58l26-22 26 22" stroke-width="1.2" opacity=".22" />
        </g>
        <circle cx="40" cy="8" r="6.5" fill="url(#mbl-gradient)" />
        <circle cx="14" cy="58" r="6.5" fill="url(#mbl-gradient)" />
        <circle cx="66" cy="58" r="6.5" fill="url(#mbl-gradient)" />
        <circle cx="40" cy="36" r="10" fill="url(#mbl-gradient)" />
        <circle cx="40" cy="36" r="4.2" fill="#fffdf8" opacity=".92" />
      </svg>
      <span>
        <strong>Miami Beach Labs</strong>
        <small>Software + AI</small>
      </span>
    </span>
  </div>;
