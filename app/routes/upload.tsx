import {type FormEvent, useState} from 'react'
import Navbar from "~/components/Navbar";
import FileUploader from "~/components/FileUploader";
import {useNavigate} from "react-router";
import {prepareInstructions, AIResponseFormat} from "../../constants";
import {usePuterStore} from "~/Lib/puter";
import {convertPdfToImage} from "~/Lib/pdf2img";
import {generateUUID} from "~/Lib/utils";

const Upload = () => {
    const { auth, isLoading, fs, ai, kv } = usePuterStore();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const handleFileSelect = (file: File | null) => {
        setFile(file)
    }

    const handleAnalyze = async ({ companyName, jobTitle, jobDescription, file }: { companyName: string, jobTitle: string, jobDescription: string, file: File  }) => {
        setIsProcessing(true);

        setStatusText('Uploading the file...');
        const uploadedFile = await fs.upload([file]);
        if(!uploadedFile) return setStatusText('Error: Failed to upload file');

        setStatusText('Converting to image...');
        const imageFile = await convertPdfToImage(file);
        if(!imageFile.file) return setStatusText('Error: Failed to convert PDF to image');

        setStatusText('Uploading the image...');
        const uploadedImage = await fs.upload([imageFile.file]);
        if(!uploadedImage) return setStatusText('Error: Failed to upload image');

        setStatusText('Preparing data...');
        const uuid = generateUUID();
        const data = {
            id: uuid,
            resumePath: uploadedFile.path,
            imagePath: uploadedImage.path,
            companyName, jobTitle, jobDescription,
            feedback: '',
        }
        await kv.set(`resume:${uuid}`, JSON.stringify(data));

        setStatusText('Analyzing...');

        const feedback = await ai.feedback(
            uploadedFile.path,
            prepareInstructions({ AIResponseFormat, jobTitle, jobDescription })
        )
        if (!feedback) return setStatusText('Error: Failed to analyze resume');
        console.log("Yoo this si sfed",feedback);
        const feedbackText = typeof feedback.message.content === 'string'
            ? feedback.message.content
            : feedback.message.content[0].text;

        // Extract JSON safely in case the model wraps with extra text or code fences
        const extractJson = (text: string) => {
            const cleaned = text.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
            const first = cleaned.indexOf('{');
            const last = cleaned.lastIndexOf('}');
            if (first !== -1 && last !== -1 && last > first) {
                return cleaned.slice(first, last + 1);
            }
            return cleaned;
        };

        try {
            const jsonString = extractJson(feedbackText);
            const parsed = JSON.parse(jsonString);

            const isExpectedFormat = (obj: any) =>
                obj && typeof obj.overallScore === 'number' && obj.ATS && obj.toneAndStyle && obj.content && obj.structure && obj.skills;

            const normalizeToExpected = (obj: any): Feedback => {
                // Fallback mapping from alternative schema to expected Feedback
                const toScore100 = (n: any) => {
                    if (typeof n === 'number') {
                        return n <= 10 ? Math.round(n * 10) : Math.round(n);
                    }
                    return 0;
                };

                const strengths: string[] = obj?.feedback?.detailed_analysis?.strengths || obj?.detailed_analysis?.strengths || [];
                const weaknesses: string[] = obj?.feedback?.detailed_analysis?.weaknesses || obj?.detailed_analysis?.weaknesses || [];
                const atsTips: string[] = obj?.feedback?.ats_optimization_tips || obj?.ats_optimization_tips || [];

                const buildTips = (goods: string[], improves: string[]) => [
                    ...goods.map((tip: string) => ({ type: 'good' as const, tip, explanation: tip })),
                    ...improves.map((tip: string) => ({ type: 'improve' as const, tip, explanation: tip })),
                ];

                return {
                    overallScore: toScore100(obj?.feedback?.overall_rating ?? obj?.overall_rating ?? 0),
                    ATS: {
                        score: toScore100(obj?.feedback?.ats_compatibility ?? obj?.ats_compatibility ?? 0),
                        tips: (atsTips as string[]).map((tip) => ({ type: 'improve' as const, tip })),
                    },
                    toneAndStyle: {
                        score: toScore100(obj?.feedback?.format_and_design ?? obj?.format_and_design ?? 0),
                        tips: buildTips(strengths, weaknesses),
                    },
                    content: {
                        score: toScore100(obj?.feedback?.content_quality ?? obj?.content_quality ?? 0),
                        tips: buildTips(strengths, weaknesses),
                    },
                    structure: {
                        score: toScore100(obj?.feedback?.format_and_design ?? obj?.format_and_design ?? 0),
                        tips: buildTips(strengths, weaknesses),
                    },
                    skills: {
                        score: toScore100(obj?.feedback?.job_alignment_score ?? obj?.job_alignment_score ?? 0),
                        tips: buildTips(
                            (obj?.feedback?.keyword_analysis?.present_keywords || obj?.keyword_analysis?.present_keywords || []).map((k: string) => `Has keyword: ${k}`),
                            (obj?.feedback?.keyword_analysis?.missing_keywords || obj?.keyword_analysis?.missing_keywords || []).map((k: string) => `Missing keyword: ${k}`)
                        ),
                    },
                };
            };

            data.feedback = isExpectedFormat(parsed) ? parsed : normalizeToExpected(parsed);
        } catch (e) {
            console.error('Failed to parse AI feedback JSON', e, { feedbackText });
            setStatusText('Error: Received invalid JSON from analysis');
            setIsProcessing(false);
            return;
        }
        await kv.set(`resume:${uuid}`, JSON.stringify(data));
        setStatusText('Analysis complete, redirecting...');
        console.log(data);
        navigate(`/resume/${uuid}`);
    }

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget.closest('form');
        if(!form) return;
        const formData = new FormData(form);

        const companyName = formData.get('company-name') as string;
        const jobTitle = formData.get('job-title') as string;
        const jobDescription = formData.get('job-description') as string;

        if(!file) return;

        handleAnalyze({companyName, jobTitle, jobDescription, file});
    }

    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover">
            <Navbar />

            <section className="main-section">
                <div className="page-heading py-16">
                    <h1>Smart feedback for your dream job</h1>
                    {isProcessing ? (
                        <>
                            <h2>{statusText}</h2>
                            <img src="/images/resume-scan.gif" className="w-full" />
                        </>
                    ) : (
                        <h2>Drop your resume for an ATS score and improvement tips</h2>
                    )}
                    {!isProcessing && (
                        <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
                            <div className="form-div">
                                <label htmlFor="company-name">Company Name</label>
                                <input type="text" name="company-name" placeholder="Company Name" id="company-name" />
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-title">Job Title</label>
                                <input type="text" name="job-title" placeholder="Job Title" id="job-title" />
                            </div>
                            <div className="form-div">
                                <label htmlFor="job-description">Job Description</label>
                                <textarea rows={5} name="job-description" placeholder="Job Description" id="job-description" />
                            </div>

                            <div className="form-div">
                                <label htmlFor="uploader">Upload Resume</label>
                                <FileUploader onFileSelect={handleFileSelect} />
                            </div>

                            <button className="primary-button" type="submit">
                                Analyze Resume
                            </button>
                        </form>
                    )}
                </div>
            </section>
        </main>
    )
}
export default Upload