import { ShieldAlert } from 'lucide-react'

export function Disclaimer() {
  return (
    <footer className="global-disclaimer">
      <ShieldAlert size={15} />
      <p>
        AG BOT provides informational technical analysis only. It is not financial advice, does not guarantee
        profits or any specific market movement, and never executes trades. Trading involves substantial risk.
        Use your own judgement and manage your risk.
      </p>
    </footer>
  )
}
