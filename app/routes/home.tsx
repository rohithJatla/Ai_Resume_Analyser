import type { Route } from "./+types/home";
import Navbar from "~/components/Navbar";
import {resumes} from "~/constants";
import ResumeCard from "~/components/ResumeCard";
import {usePuterStore} from "~/Lib/puter";
import {useLocation, useNavigate} from "react-router";
import {useEffect} from "react";


export function meta({}: Route.MetaArgs) {
  return [
    { title: "Resly" },
    { name: "description", content: "Free tool to analyze your resume! to land your dream job" },
  ];
}

export default function Home() {

    const {isLoading, auth} = usePuterStore();
    const navigate = useNavigate();

    useEffect(() => {
        if(!auth.isAuthenticated){
            navigate("/auth?next=/");
        }
    },[auth.isAuthenticated])


    return <main className="bg-[url('/images/bg-main.svg')] bg-cover">
      <Navbar></Navbar>

      <section className="main-section">
          <div className="page-heading py-16">
              <h1> Track your Applications & Resume Ratings</h1>
              <h2>Review your submissions and check Ai-powered feedback.</h2>
          </div>

          {resumes.length > 0 && (
              <div className="resumes-section">
                  {resumes.map((resume) => (
                      <ResumeCard key={resume.id} resume={resume} />
                  ))
                  }
              </div>
          )}

      </section>




  </main>;
}
