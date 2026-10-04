import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import AuthExperience from "@/components/AuthExperience";
import { Helmet } from "react-helmet";

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  const params = new URLSearchParams(window.location.search);
  const urlRedirect = params.get('redirect');
  const redirectTo = urlRedirect || localStorage.getItem('authRedirect') || '/';
  // /auth?forgot=1 (linked from member emails) opens "Forgot password" — even for members who are already signed in
  const forgot = params.has('forgot');

  useEffect(() => {
    if (urlRedirect) {
      localStorage.setItem('authRedirect', urlRedirect);
    }
  }, [urlRedirect]);

  useEffect(() => {
    if (!isLoading && user && !forgot) {
      localStorage.removeItem('authRedirect');
      setLocation(redirectTo);
    }
  }, [isLoading, user, setLocation, redirectTo, forgot]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const handleLoginSuccess = () => {
    localStorage.removeItem('authRedirect');
    setTimeout(() => {
      setLocation(redirectTo);
    }, 400);
  };

  return (
    <>
      <Helmet>
        <title>Sign In | Christ Collective</title>
        <meta name="description" content="Sign in to Christ Collective to connect with your community and make a difference through faith." />
      </Helmet>
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full flex justify-center">
          <AuthExperience variant="desktop" onLoginSuccess={handleLoginSuccess} />
        </div>
      </div>
    </>
  );
}
