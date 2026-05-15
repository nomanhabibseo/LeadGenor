/** Compact brand marks for SMTP provider tiles (simplified shapes; not official assets). */

export function SmtpProviderLogo({ id, className }: { id: string; className?: string }) {
  const cn = className ?? "h-10 w-10 shrink-0";
  switch (id) {
    case "gmail-smtp":
    case "google-workspace":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <path fill="#EA4335" d="M6 18v12h8V18l8-6v24h-8V18z" />
          <path fill="#34A853" d="M24 12l8 6v12h8V18z" />
          <path fill="#4285F4" d="M24 12L6 18v12l8-6V18z" />
          <path fill="#FBBC05" d="M32 30h8V18l-8 6v6z" />
        </svg>
      );
    case "microsoft-365":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="22" height="22" x="4" y="4" fill="#F25022" rx="2" />
          <rect width="22" height="22" x="22" y="4" fill="#7FBA00" rx="2" />
          <rect width="22" height="22" x="4" y="22" fill="#00A4EF" rx="2" />
          <rect width="22" height="22" x="22" y="22" fill="#FFB900" rx="2" />
        </svg>
      );
    case "outlook-smtp":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="8" fill="#0078D4" />
          <path fill="white" d="M14 16h20v6H14zm0 10h14v6H14z" />
        </svg>
      );
    case "yahoo":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#6001D2" />
          <text x="24" y="31" textAnchor="middle" fill="white" fontSize="18" fontWeight="800" fontFamily="system-ui">
            Y!
          </text>
        </svg>
      );
    case "icloud":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#3693F7" />
          <path
            fill="white"
            d="M32 22c-1.2 0-2.3.4-3.2 1.1A5.5 5.5 0 0 0 16 24a4 4 0 0 0-1 7.9h18a3.5 3.5 0 0 0 .1-7 5.5 5.5 0 0 0-1-2.9z"
            opacity=".95"
          />
        </svg>
      );
    case "aol":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#000" />
          <path fill="#FFCB05" d="M24 12L14 34h6l2-5h4l2 5h6L24 12zm0 10l2 5h-4l2-5z" />
        </svg>
      );
    case "gmx":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#1C449C" />
          <text x="24" y="30" textAnchor="middle" fill="white" fontSize="11" fontWeight="800" fontFamily="system-ui, sans-serif">
            GMX
          </text>
        </svg>
      );
    case "webde":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#FFD800" />
          <text x="24" y="22" textAnchor="middle" fill="#003366" fontSize="9" fontWeight="800" fontFamily="system-ui">
            Web
          </text>
          <text x="24" y="34" textAnchor="middle" fill="#003366" fontSize="11" fontWeight="800" fontFamily="system-ui">
            .de
          </text>
        </svg>
      );
    case "yandex":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#FC3F1D" />
          <path fill="white" d="M28 14h-8l-6 20h5.5l1.2-4H28l1.2 4H35L28 14zm-6.8 12 2.8-9 2.8 9h-5.6z" />
        </svg>
      );
    case "mailru":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#168DE2" />
          <circle cx="24" cy="24" r="10" fill="none" stroke="white" strokeWidth="3" />
          <circle cx="24" cy="24" r="4" fill="white" />
        </svg>
      );
    case "mailcom":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#0A6CFF" />
          <text x="24" y="30" textAnchor="middle" fill="white" fontSize="10" fontWeight="800" fontFamily="system-ui">
            mail
          </text>
        </svg>
      );
    case "zoho":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect x="4" y="4" width="18" height="18" rx="3" fill="#E42527" />
          <rect x="26" y="4" width="18" height="18" rx="3" fill="#2BAC24" />
          <rect x="4" y="26" width="18" height="18" rx="3" fill="#F8B400" />
          <rect x="26" y="26" width="18" height="18" rx="3" fill="#2274E5" />
        </svg>
      );
    case "fastmail":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#635bff" />
          <text x="24" y="30" textAnchor="middle" fill="white" fontSize="12" fontWeight="800" fontFamily="system-ui">
            FM
          </text>
        </svg>
      );
    case "proton":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#6d4aff" />
          <path
            fill="white"
            d="M24 12c-6 0-10 4-10 10v10h6V28c0-3 2-5 4-5s4 2 4 5v4h6V22c0-6-4-10-10-10z"
            opacity=".95"
          />
        </svg>
      );
    case "posteo":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#0b8043" />
          <text x="24" y="30" textAnchor="middle" fill="white" fontSize="9" fontWeight="800" fontFamily="system-ui">
            Posteo
          </text>
        </svg>
      );
    case "runbox":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#0066b3" />
          <text x="24" y="30" textAnchor="middle" fill="white" fontSize="9" fontWeight="800" fontFamily="system-ui">
            Runbox
          </text>
        </svg>
      );
    case "mailbox-org":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#1a9d4a" />
          <path fill="white" d="M14 18h20v3l-10 7-10-7z" />
          <rect x="14" y="26" width="20" height="8" rx="1" fill="white" opacity=".25" />
        </svg>
      );
    case "ionos":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#0b5ed7" />
          <text x="24" y="31" textAnchor="middle" fill="white" fontSize="13" fontWeight="800" fontFamily="system-ui">
            I
          </text>
        </svg>
      );
    case "infomaniak":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#0098ff" />
          <path stroke="white" strokeWidth="3" d="M24 14v20M14 24h20" />
        </svg>
      );
    case "hostinger":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#673DE6" />
          <text x="24" y="32" textAnchor="middle" fill="white" fontSize="22" fontWeight="700" fontFamily="system-ui">
            H
          </text>
        </svg>
      );
    case "bluehost":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#196BDE" />
          <text x="24" y="30" textAnchor="middle" fill="white" fontSize="10" fontWeight="800" fontFamily="system-ui">
            BH
          </text>
        </svg>
      );
    case "siteground":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#371c6b" />
          <circle cx="24" cy="24" r="8" fill="#fca50a" />
        </svg>
      );
    case "dreamhost":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#007318" />
          <text x="24" y="30" textAnchor="middle" fill="white" fontSize="10" fontWeight="800" fontFamily="system-ui">
            DH
          </text>
        </svg>
      );
    case "godaddy":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#1BDBDB" />
          <path fill="#111" d="M16 28c2-6 6-10 10-10 3 0 5 2 6 5l-4 2c-1-2-2-3-4-3-3 0-5 4-6 8 3-1 6-3 9-6l3 3c-4 4-9 7-14 8z" />
        </svg>
      );
    case "namecheap":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#ff6600" />
          <text x="24" y="30" textAnchor="middle" fill="white" fontSize="9" fontWeight="800" fontFamily="system-ui">
            NC
          </text>
        </svg>
      );
    case "private-email":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#2563EB" />
          <path fill="white" d="M12 18h24v4l-12 8-12-8z" />
        </svg>
      );
    case "titan":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#0f172a" />
          <path fill="white" d="M14 14h8l4 10 4-10h8L26 34h-4z" />
        </svg>
      );
    case "maildoso":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#E11D48" />
          <text x="24" y="32" textAnchor="middle" fill="white" fontSize="20" fontWeight="700" fontFamily="system-ui">
            m
          </text>
        </svg>
      );
    case "rackspace":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#c40022" />
          <path fill="white" d="M24 12l3 8h8l-6 5 2 9-7-5-7 5 2-9-6-5h8z" />
        </svg>
      );
    case "a2hosting":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#0f5aa7" />
          <text x="24" y="31" textAnchor="middle" fill="white" fontSize="14" fontWeight="800" fontFamily="system-ui">
            A2
          </text>
        </svg>
      );
    case "migadu":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#0d9488" />
          <text x="24" y="30" textAnchor="middle" fill="white" fontSize="10" fontWeight="800" fontFamily="system-ui">
            M
          </text>
        </svg>
      );
    case "ovh":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#000e9c" />
          <text x="24" y="30" textAnchor="middle" fill="#fff200" fontSize="12" fontWeight="900" fontFamily="system-ui">
            OVH
          </text>
        </svg>
      );
    case "hetzner":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#d50c2d" />
          <text x="24" y="30" textAnchor="middle" fill="white" fontSize="11" fontWeight="800" fontFamily="system-ui">
            H
          </text>
        </svg>
      );
    case "amazon-workmail":
    case "amazon-ses":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="8" fill="#FF9900" />
          <text x="24" y="31" textAnchor="middle" fill="#111" fontSize="13" fontWeight="800" fontFamily="system-ui">
            AWS
          </text>
        </svg>
      );
    case "sendgrid":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="8" fill="#1A82E2" />
          <path fill="white" d="M12 16h6v16h-6zm9 0h6v16h-6zm9 0h6v16h-6z" opacity=".9" />
        </svg>
      );
    case "brevo":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#0c9969" />
          <path fill="white" d="M14 24c0-4 3-7 7-7h6v14h-6c-4 0-7-3-7-7zm16-7h6v14h-6z" />
        </svg>
      );
    case "mailjet":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#952c6e" />
          <path fill="white" d="M16 16h16v4H16zm0 8h10v4H16zm0 8h14v4H16z" />
        </svg>
      );
    case "mailgun":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#f06b66" />
          <text x="24" y="30" textAnchor="middle" fill="white" fontSize="9" fontWeight="800" fontFamily="system-ui">
            MG
          </text>
        </svg>
      );
    case "postmark":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#ffde00" />
          <circle cx="24" cy="24" r="8" fill="#333" />
        </svg>
      );
    case "mandrill":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#ff9f1c" />
          <path fill="#222" d="M24 14c-4 0-7 3-8 7h16c-1-4-4-7-8-7zm-10 9c0 6 4 11 10 11s10-5 10-11H14z" />
        </svg>
      );
    case "elastic-email":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#2b6cb0" />
          <text x="24" y="30" textAnchor="middle" fill="white" fontSize="10" fontWeight="800" fontFamily="system-ui">
            EE
          </text>
        </svg>
      );
    case "resend":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#0a0a0a" />
          <text x="24" y="31" textAnchor="middle" fill="white" fontSize="14" fontWeight="800" fontFamily="system-ui">
            R
          </text>
        </svg>
      );
    case "sparkpost":
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#fa6423" />
          <path fill="white" d="M24 12l8 14H16l8-14zm0 8L18 30h12l-6-10z" />
        </svg>
      );
    default:
      return (
        <svg className={cn} viewBox="0 0 48 48" aria-hidden>
          <rect width="48" height="48" rx="10" fill="#64748b" />
          <path fill="white" d="M14 20h20v3l-10 7-10-7z" />
        </svg>
      );
  }
}
