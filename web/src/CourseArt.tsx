export function CourseArt({ variant = 0, hero = false }: { variant?: number; hero?: boolean }) {
  const colors = ["#317f6b", "#bd7047", "#7a61a7", "#477fad"];
  const accent = colors[variant % colors.length];
  return (
    <svg className={hero ? "course-art hero-art" : "course-art"} viewBox="0 0 400 230" fill="none" aria-hidden="true">
      <circle cx="208" cy="119" r="93" fill="white" opacity=".3" />
      <circle cx="208" cy="119" r="74" stroke={accent} strokeDasharray="3 8" opacity=".2" />
      <path d="m53 163 138-62 157 63-138 60Z" fill={accent} opacity=".12" />
      <rect x="91" y="41" width="232" height="147" rx="11" fill={accent} opacity=".18" transform="rotate(-7 91 41)" />
      <rect x="85" y="36" width="230" height="146" rx="10" fill="#183c35" transform="rotate(-7 85 36)" />
      <path d="m86 60 228-28" stroke="#d2ece0" opacity=".2" />
      <circle cx="99" cy="46" r="3" fill="#edbd79" /><circle cx="110" cy="45" r="3" fill="#b5d9bb" /><circle cx="121" cy="43" r="3" fill="#8bbaac" />
      <g transform="rotate(-7 85 36)">
        <text x="104" y="92" fill="#e7c88e" fontFamily="monospace" fontSize="13">{variant === 2 ? "data = [1, 2, 3]" : variant === 3 ? "def explore(n):" : "def hello_world():"}</text>
        <text x="117" y="117" fill="#b9dcd0" fontFamily="monospace" fontSize="13">{variant === 2 ? "for item in data:" : variant === 3 ? "return explore(n-1)" : "return 'Hello, you!'"}</text>
        <path d="M105 140h86m-86 15h125" stroke="#6f9b8d" strokeWidth="4" strokeLinecap="round" opacity=".4" />
      </g>
      <rect x="262" y="122" width="71" height="71" rx="17" fill="white" transform="rotate(9 262 122)" />
      <text x="276" y="169" fill={accent} fontSize="27" fontWeight="700" fontFamily="monospace">{["Py", "ƒ", "[]", "∞"][variant % 4]}</text>
      <rect x="56" y="108" width="57" height="43" rx="10" fill="#fdfbf2" transform="rotate(-12 56 108)" />
      <path d="m72 125 5 5 11-15" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m334 68 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill={accent} opacity=".55" />
      <circle cx="62" cy="66" r="5" fill={accent} opacity=".4" />
    </svg>
  );
}
