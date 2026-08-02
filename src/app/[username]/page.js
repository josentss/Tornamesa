import UserProfileClient from "./UserProfileClient";

export async function generateMetadata({ params }) {
  const username = params.username;

  return {
    title: `${username} • Tornamesa`,
    description: `Check out ${username}'s music profile and listening activity on Tornamesa.`,
    openGraph: {
      title: `${username} on Tornamesa`,
      description: `Music profile of ${username}`,
      type: "profile",
      siteName: "Tornamesa",
    },
    twitter: {
      card: "summary",
      title: `${username} on Tornamesa`,
      description: `Music profile of ${username}`,
    },
  };
}

export default function Page({ params }) {
  return <UserProfileClient params={params} />;
}
