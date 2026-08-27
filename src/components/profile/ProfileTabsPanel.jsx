"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import ActivityFeed from "@/components/profile/ActivityFeed";
import MonthlyTopWidget from "@/components/profile/MonthlyTopWidget";
import RatingChart from "@/components/profile/RatingChart";
import ReviewsList from "@/components/profile/ReviewsList";

export default function ProfileTabsPanel({
  profileData,
  stats,
  recentReviews,
  userLists,
  tabs,
  activeTab,
  setActiveTab,
  canShowActivity,
  canShowDiaryLink,
  hasDiaryContent,
  diaryBase,
  isOwner,
  showNewList,
  setShowNewList,
  newListName,
  setNewListName,
  creatingList,
  onCreateList,
}) {
  const router = useRouter();

  return (
    <>
                {profileData.favorite_albums?.length > 0 && (
                  <section className="max-w-5xl mx-auto w-full px-4 sm:px-6 md:px-8 mt-10 sm:mt-14">
                    <h2 className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-5 text-center">
                      Favorite Albums
                    </h2>
                    <div className="grid grid-cols-3 gap-3 sm:gap-5 max-w-xs sm:max-w-md mx-auto">
                      {profileData.favorite_albums.map((fav, idx) => (
                        <a
                          key={idx}
                          href={`/album/${fav.id}`}
                          className="block group"
                        >
                          <div className="aspect-square rounded-lg sm:rounded-xl overflow-hidden mb-2 border border-[#2a3645] shadow-sm transition-all duration-300 ease-out group-hover:border-[#7cc7e8]/50 group-hover:shadow-md group-hover:shadow-black/25">
                            {fav.coverUrl ? (
                              <Image
                                src={fav.coverUrl}
                                alt={fav.title || ""}
                                width={160}
                                height={160}
                                className="object-cover w-full h-full"
                                sizes="(max-width: 640px) 30vw, 160px"
                              />
                            ) : (
                              <div className="w-full h-full bg-[#1f2b3a]" />
                            )}
                          </div>
                          <p className="text-[11px] sm:text-xs font-semibold truncate text-center group-hover:text-[#7cc7e8]">
                            {fav.title}
                          </p>
                          <p className="text-[10px] text-stone-500 truncate text-center">
                            {fav.artist}
                          </p>
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                <section className="max-w-5xl mx-auto w-full px-4 sm:px-6 md:px-8 mt-12 sm:mt-16 flex-1 pb-16 sm:pb-20">
                  <div className="flex border-b border-[#2a3645] mb-6 sm:mb-8 overflow-x-auto scrollbar-hide">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`pb-3 sm:pb-3.5 px-4 sm:px-5 text-sm font-semibold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${
                          activeTab === tab.id
                            ? "border-[#7cc7e8] text-[#7cc7e8]"
                            : "border-transparent text-stone-400 hover:text-white"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col lg:flex-row gap-6 sm:gap-8">
                    <div className="flex-1 min-w-0">
                      {activeTab === "activity" && canShowActivity && (
                        <div>
                          <ActivityFeed activities={stats?.recentActivity || []} />
                          {canShowDiaryLink && hasDiaryContent && (
                            <div className="mt-5 text-center sm:text-left">
                              <button
                                type="button"
                                onClick={() => router.push(diaryBase)}
                                className="text-xs text-[#7cc7e8] hover:underline"
                              >
                                View full diary
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === "activity" && !canShowActivity && (
                        <p className="text-sm text-stone-500 py-8 text-center">
                          Recent activity is hidden.
                        </p>
                      )}

                      {activeTab === "reviews" && (
                        <div>
                          <ReviewsList
                            reviews={recentReviews}
                            emptyMessage="Reviews written by this user will appear here."
                            username={profileData.username}
                          />
                          {recentReviews.length > 0 && (
                            <div className="mt-5 text-center sm:text-left">
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(`/${profileData.username}/reviews`)
                                }
                                className="text-xs text-[#7cc7e8] hover:underline"
                              >
                                View all reviews
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === "lists" && (
                        <div className="space-y-4">
                          {isOwner && (
                            <div className="mb-2">
                              {showNewList ? (
                                <form
                                  onSubmit={onCreateList}
                                  className="flex flex-col sm:flex-row gap-2"
                                >
                                  <input
                                    value={newListName}
                                    onChange={(e) => setNewListName(e.target.value)}
                                    placeholder="New list name"
                                    className="flex-1 min-w-0 bg-[#0a121c] border border-[#2a3645] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7cc7e8]"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="submit"
                                      disabled={
                                        creatingList || !newListName.trim()
                                      }
                                      className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#7cc7e8] text-[#0a121c] disabled:opacity-50"
                                    >
                                      {creatingList ? "..." : "Create"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowNewList(false);
                                        setNewListName("");
                                      }}
                                      className="text-sm px-3 py-2 text-stone-400"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setShowNewList(true)}
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7cc7e8] border border-[#2a3645] hover:border-[#7cc7e8]/40 bg-[#0a121c]/50 hover:bg-[#0a121c] px-3 py-2 rounded-lg transition-colors"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    className="w-3.5 h-3.5"
                                    aria-hidden
                                  >
                                    <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                                  </svg>
                                  Create new list
                                </button>
                              )}
                            </div>
                          )}

                          {userLists.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {userLists.map((list) => (
                                <button
                                  key={list.id}
                                  type="button"
                                  onClick={() => router.push(`/list/${list.id}`)}
                                  className="text-left bg-[#131e2c] border border-[#2a3645] rounded-xl p-4 sm:p-5 hover:border-[#3d5068] transition-colors group flex items-center gap-3 overflow-hidden"
                                >
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-semibold text-white group-hover:text-[#7cc7e8] transition-colors truncate">
                                      {list.name}
                                    </h4>
                                    {list.description && (
                                      <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                                        {list.description}
                                      </p>
                                    )}
                                    <p className="text-xs text-stone-400 mt-2">
                                      {list.count} album
                                      {list.count !== 1 ? "s" : ""}
                                    </p>
                                  </div>
                                  {list.previewCovers?.length > 0 && (
                                    <div className="relative flex-shrink-0 w-[72px] h-12">
                                      {list.previewCovers
                                        .slice(0, 3)
                                        .map((cover, i) => (
                                          <div
                                            key={i}
                                            className="absolute top-0 w-12 h-12 rounded-md overflow-hidden border border-[#0a0f16] shadow-md bg-[#1f2b3a]"
                                            style={{
                                              right: `${i * 10}px`,
                                              zIndex: 3 - i,
                                              opacity: 1 - i * 0.15,
                                            }}
                                          >
                                            <Image
                                              src={cover}
                                              alt=""
                                              width={48}
                                              height={48}
                                              className="object-cover w-full h-full"
                                              sizes="48px"
                                            />
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                              <p className="text-stone-400 text-sm font-medium">
                                No lists yet
                              </p>
                              <p className="text-stone-500 text-xs mt-1">
                                Lists created by this user will appear here.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="w-full lg:w-72 space-y-5 sm:space-y-6 flex-shrink-0">
                      <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-4 sm:p-5">
                        <h3 className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-3 sm:mb-4 pb-2 border-b border-[#2a3645]">
                          Monthly Top
                        </h3>
                        <MonthlyTopWidget
                          albums={stats?.monthlyTop || []}
                          username={profileData.username}
                        />
                      </div>
                      <div className="bg-[#131e2c] border border-[#2a3645] rounded-xl p-4 sm:p-5">
                        <h3 className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-3 sm:mb-4 pb-2 border-b border-[#2a3645]">
                          Rating Chart
                        </h3>
                        <div className="overflow-x-auto">
                          <RatingChart
                            distribution={stats?.ratingDistribution || {}}
                            username={profileData.username}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
    </>
  );
}
