export function checkSubscription(user: any, requiredPlan: string) {
    if (!user.subscription || user.subscription.planId !== requiredPlan || user.subscription.status !== "active") {
        throw new Error("Subscription required");
    }
}
