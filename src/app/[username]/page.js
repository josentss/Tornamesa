import UserProfileClient from "./UserProfileClient";

export async function generateMetadata({ params }) {
  const username = params?.username || "User";

  return {
    title: username,
    description: `Check out ${username}'s music profile and listening activity on Tornamesa.`,
    openGraph: {
      title: `${username} on Tornamesa`,
      description: `Music profile of ${username}`,
      siteName: "Tornamesa",
    },
    twitter: {
      title: `${username} on Tornamesa`,
      description: `Music profile of ${username}`,
    },
  };
}

export default function Page({ params }) {
  return <UserProfileClient params={params} />;
}
