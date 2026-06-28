const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
  method: 'POST',
  headers: { Authorization: 'Bearer AQXiKuRWpkSK14zYCo5aM41MkjRtpUtxsHxbyTo9AO6Stlj9sDZ72nAspK1zz-Qr5l9BsIbrmfTnF4MQeAJzXmpIfYR-wRlVy5wi6NZ7uSQLOMI5M9DiBLAkK8_zNVrCToNd4iH3vKzbCrPY8VdBtl9j6ivtZL2gnQehWFovpTAgDqI89-_6PWMgcSJMNHULOKKL_ITM77IS8jXRj1uvFS8Hk7vSynmULGULstKC4xgKAIGEGuGwV_ZpIEYoqngaY3moXU2pdZMhVq86xyVvLvYFKcB4PO9As5QzUiIZjjYeVZOmce0taNxbXY7P6pLUXWdIqENxDbzUggg8Xzx3AATdKMgcJg', 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
  body: JSON.stringify({
    author: 'urn:li:person:8Jd1fx0eiQ',
    lifecycleState: 'PUBLISHED',
    specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: 'Three posts. One pipeline. Zero manual effort.\n\nInlight Agency OS just completed its first end-to-end autonomous content run:\n\n1. Researched Google Trends + News API\n2. Generated 20 content ideas via AI\n3. Selected stock photos (Unsplash + Pexels)\n4. Wrote full LinkedIn, Facebook, X, and blog content\n5. Created a 5-day content calendar\n6. Queued 20 pieces for human approval\n7. Published this post autonomously\n\nThe approval queue is live and waiting for review.\n\nThis is what AI-powered agency operations look like.\n\n#InlightOS #AIAutomation #ContentPipeline #DigitalAgency' }, shareMediaCategory: 'NONE' } },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  })
})
const text = await res.text()
console.log(`HTTP ${res.status}: ${text.slice(0, 300)}`)
