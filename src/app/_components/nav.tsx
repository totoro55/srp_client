import Link from 'next/link'

export default function Nav() {
    return (
        <nav>
            {/* Prefetched when the link is hovered or enters the viewport */}
            <Link href="/">Home</Link>
            <Link href="/main">Main</Link>
        </nav>
    )
}