"use client";

import React, { useState, useEffect, useRef } from "react";

export default function ReelModal({ isOpen, onClose }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(8);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [progress, setProgress] = useState(0);

  const videoRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setIsPlaying(true);
      setProgress(0);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.muted = false;
        videoRef.current.volume = 1.0;

        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // If browser autoplay policy blocks unmuted audio before user interaction,
            // play immediately upon the very next touch/click anywhere on screen
            const enableSoundAndPlay = () => {
              if (videoRef.current) {
                videoRef.current.muted = false;
                videoRef.current.volume = 1.0;
                videoRef.current.play().catch(() => {});
              }
              document.removeEventListener("click", enableSoundAndPlay);
              document.removeEventListener("touchstart", enableSoundAndPlay);
            };
            document.addEventListener("click", enableSoundAndPlay, { once: true });
            document.addEventListener("touchstart", enableSoundAndPlay, { once: true });
          });
        }
      }
    } else {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      setProgress((current / duration) * 100);
    }
  };

  const toggleLike = (e) => {
    e.stopPropagation();
    if (isLiked) {
      setIsLiked(false);
      setLikesCount((prev) => Math.max(0, prev - 1));
    } else {
      setIsLiked(true);
      setLikesCount((prev) => prev + 1);
    }
  };

  const toggleSave = (e) => {
    e.stopPropagation();
    setIsSaved(!isSaved);
  };

  const handlePostComment = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setComments((prev) => [...prev, { text: commentText.trim(), user: "user", time: "Just now" }]);
    setCommentText("");
  };

  return (
    <div className="reel-modal-overlay" onClick={onClose}>
      {/* Top Right Close Button */}
      <button className="reel-modal-close-btn" onClick={onClose} aria-label="Close">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke="#FFFFFF" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Modal Dialog Card */}
      <div className="reel-modal-card" onClick={(e) => e.stopPropagation()}>
        
        {/* Left: Reel Video Player Area */}
        <div className="reel-media-section" onClick={togglePlay}>
          {/* Progress Bar at Top */}
          <div className="reel-progress-bar-container">
            <div className="reel-progress-bar" style={{ width: `${progress}%` }}></div>
          </div>

          {/* Reel Video Player (Plays Automatically with Sound) */}
          <div className="reel-video-container">
            <video
              ref={videoRef}
              src="/posts/reel.mp4"
              poster="/posts/post4.png"
              autoPlay
              playsInline
              loop
              onTimeUpdate={handleTimeUpdate}
              className="reel-video-element"
              controlsList="nodownload noplaybackrate nofullscreen"
              disablePictureInPicture
              onContextMenu={(e) => e.preventDefault()}
            />

            {/* Play/Pause Overlay Icon (shows when paused) */}
            {!isPlaying && (
              <div className="reel-paused-overlay">
                <div className="reel-play-circle">
                  <svg viewBox="0 0 24 24" width="36" height="36" fill="#FFFFFF">
                    <polygon points="6 4 20 12 6 20 6 4" />
                  </svg>
                </div>
              </div>
            )}

            {/* Bottom Media Controls */}
            <div className="reel-media-controls">
              <div className="reel-tag-account-btn" title="mr_in.nocent_yogi" onClick={(e) => e.stopPropagation()}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="#FFFFFF">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Reel Post Details, Caption, Actions & Comments */}
        <div className="reel-details-section">
          
          {/* Header */}
          <div className="reel-details-header">
            <div className="reel-user-info">
              <div className="reel-avatar">
                <img src="/highlights/profile.jpg" alt="mr_in.nocent_yogi" />
              </div>
              <div className="reel-user-names">
                <div className="reel-username-row">
                  <span className="reel-username">mr_in.nocent_yogi</span>
                  <span className="reel-dot">•</span>
                  <button className="reel-follow-link">Follow</button>
                </div>
                <span className="reel-audio-sub">Original audio</span>
              </div>
            </div>

            <button className="reel-more-btn" title="More options">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="#FFFFFF">
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
                <circle cx="5" cy="12" r="2" />
              </svg>
            </button>
          </div>

          {/* Scrollable Caption & Comments Area */}
          <div className="reel-caption-body">
            <div className="reel-caption-item">
              <div className="reel-avatar">
                <img src="/highlights/profile.jpg" alt="mr_in.nocent_yogi" />
              </div>
              <div className="reel-caption-content">
                <p>
                  <strong className="reel-caption-user">mr_in.nocent_yogi</strong>{" "}
                  House warming &quot;Puthumanai Puguvizha&quot; Invitations
                </p>
                <p>For your events book our invitation services</p>
                <p>Contact us 9360619459</p>
                
                <div className="reel-hashtags">
                  <span>#reach</span> <span>#TRENDINGNOW</span> <span>#housewarmingceremony💖</span> <span>🏠</span> <span>#celebration</span> <span>#trendingreels</span>
                </div>

                <div className="reel-meta-row">
                  <span className="reel-time-ago">1 h</span>
                  <button className="reel-translation-btn">See Translation</button>
                </div>
              </div>
            </div>

            {/* Render any added comments */}
            {comments.map((c, i) => (
              <div className="reel-caption-item" key={i}>
                <div className="reel-avatar-small">
                  <img src="/highlights/profile.jpg" alt="User" />
                </div>
                <div className="reel-caption-content">
                  <p>
                    <strong className="reel-caption-user">{c.user}</strong> {c.text}
                  </p>
                  <div className="reel-meta-row">
                    <span className="reel-time-ago">{c.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Actions & Engagement Section */}
          <div className="reel-details-footer">
            {/* Boost Reel & View Insights Row */}
            <div className="reel-promo-bar">
              <button className="reel-insights-link">View Insights</button>
              <button className="reel-boost-btn">Boost reel</button>
            </div>

            {/* Main Action Buttons */}
            <div className="reel-actions-bar">
              <div className="reel-actions-left">
                {/* Heart / Like */}
                <button className="reel-action-btn" onClick={toggleLike} title="Like">
                  {isLiked ? (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="#ED4956">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  )}
                </button>

                {/* Comment */}
                <button className="reel-action-btn" title="Comment">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                </button>

                {/* Repost / Remix */}
                <button className="reel-action-btn" title="Repost">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                    <path d="M17 1l4 4-4 4" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <path d="M7 23l-4-4 4-4" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                </button>

                {/* Direct Share */}
                <button className="reel-action-btn" title="Share">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                    <path d="M22 2L11 13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>

              {/* Bookmark / Save */}
              <div className="reel-actions-right">
                <button className="reel-action-btn" onClick={toggleSave} title="Save">
                  {isSaved ? (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="#FFFFFF">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#FFFFFF" strokeWidth="2">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Liked by Row */}
            <div className="reel-likes-row">
              <div className="reel-mini-avatars">
                <span className="mini-avatar a1"></span>
                <span className="mini-avatar a2"></span>
                <span className="mini-avatar a3"></span>
              </div>
              <span className="reel-likes-text">
                Liked by <strong>ram.eshkumar1986</strong> and <strong>{likesCount - 1} others</strong>
              </span>
            </div>

            {/* Timestamp */}
            <div className="reel-timestamp">1 hour ago</div>

            {/* Add a Comment Bar */}
            <form className="reel-comment-box" onSubmit={handlePostComment}>
              <button type="button" className="reel-emoji-btn" title="Insert emoji">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#FFFFFF" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" />
                  <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" />
                </svg>
              </button>
              <input
                type="text"
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="reel-comment-input"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className={`reel-post-comment-btn ${commentText.trim() ? "active" : ""}`}
              >
                Post
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
