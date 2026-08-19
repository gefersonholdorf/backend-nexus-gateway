export type Either<L, R> =
	| { left: L; right?: never }
	| { left?: never; right: R };

export interface Service<ServiceRequest, ServiceResponse> {
	execute(
		serviceRequest: ServiceRequest,
	): Promise<Either<Error, ServiceResponse>>;
}