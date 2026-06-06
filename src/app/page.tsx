import HomeClient from "./_components/home-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  return <HomeClient assignments={[]} />;
}
