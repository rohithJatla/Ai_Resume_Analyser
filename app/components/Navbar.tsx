import React, {useMemo, useState} from 'react'
import {Link, useLocation} from "react-router";
import {usePuterStore} from "~/Lib/puter";

const Navbar = () => {
    const { auth, isLoading, fs, kv } = usePuterStore();
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const [wiping, setWiping] = useState(false);

    const initials = useMemo(() => {
        const name = auth.user?.username || '';
        return name ? name.trim().charAt(0).toUpperCase() : '?';
    }, [auth.user?.username]);

    const handleWipe = async () => {
        if (!auth.isAuthenticated || wiping) return;
        const confirmWipe = window.confirm(
            "This will delete all uploaded resumes and cached data. Continue?"
        );
        if (!confirmWipe) return;
        setWiping(true);
        try {
            const files = (await fs.readDir("./")) as FSItem[] | undefined;
            if (files && files.length > 0) {
                for (const file of files) {
                    await fs.delete(file.path);
                }
            }
            await kv.flush();
        } catch (e) {
            console.error("Failed to wipe app data", e);
        } finally {
            setWiping(false);
            setOpen(false);
        }
    };

    return (
        <nav className="navbar">
            <Link to="/">
                <p className="text-2xl font-bold text-gradient">RESUMELY</p>
            </Link>
            <div className="flex items-center gap-3">
                <div className="relative">
                    <button
                        className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-semibold select-none"
                        onClick={() => setOpen((v) => !v)}
                        aria-label="Profile"
                    >
                        {initials}
                    </button>
                    {open && (
                        <div className="absolute right-0 mt-2 w-72 z-50">
                            <div className="gradient-border">
                                <div className="bg-white rounded-2xl p-4 shadow-lg flex flex-col gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-semibold">
                                            {initials}
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Signed in as</p>
                                            <p className="font-semibold break-all">{auth.user?.username || 'Guest'}</p>
                                        </div>
                                    </div>
                                    {auth.isAuthenticated && (
                                        <div className="flex items-center justify-between mt-1 mx-1">
                                            <p className="text-xs text-red-600">Wipes uploaded files and KV</p>
                                            <button className={`primary-button ${wiping ? 'opacity-60 cursor-not-allowed' : ''}`} onClick={handleWipe} disabled={wiping}>
                                                <p>{wiping ? 'Wiping...' : 'Wipe All'}</p>
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex gap-2 justify-end mt-2">
                                        {isLoading ? (
                                            <button className="primary-button opacity-60 cursor-not-allowed"><p>Loading...</p></button>
                                        ) : auth.isAuthenticated ? (
                                            <button className="primary-button" onClick={() => { setOpen(false); auth.signOut(); }}>
                                                <p>Log Out</p>
                                            </button>
                                        ) : (
                                            <Link className="primary-button" to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`} onClick={() => setOpen(false)}>
                                                <p>Log In</p>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <Link to="/upload" className="primary-button w-fit">
                    Upload Resume
                </Link>
            </div>
        </nav>
    )
}
export default Navbar
