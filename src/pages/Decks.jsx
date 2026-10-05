import DeckList from '@/pages/DeckList'

// /decks route — the shell owns the page title ("Decks"); this page only
// supplies the content width and the shared deck grid.
export default function Decks() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <DeckList />
    </div>
  )
}
