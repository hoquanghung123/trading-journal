import { fetchReviews } from "../src/lib/reviews";

async function debug() {
  try {
    const reviews = await fetchReviews();
    console.log("Total Reviews:", reviews.length);
    if (reviews.length > 0) {
      console.log("Latest Review Period:", reviews[0].period);
      console.log("Top Mistakes:", JSON.stringify(reviews[0].topMistakes, null, 2));
    } else {
      console.log("No reviews found.");
    }
  } catch (e) {
    console.error("Error fetching reviews:", e);
  }
}

debug();
