import { Footer, Header } from "../../components/storefront";
import { SearchResults } from "../../components/search-results";

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  return (
    <>
      <Header />
      <SearchResults query={q} />
      <Footer />
    </>
  );
}
