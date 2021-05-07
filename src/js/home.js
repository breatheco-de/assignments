/* global process */
import React, { useState } from "react";
import qs from "query-string";
import { Notifier, Notify } from "bc-react-notifier";
import Select from "react-select";

const host = process.env.API_HOST;

const ModalComponent = properties => {
	const [comments, setComments] = useState("");
	return (
		<div className="confirm-status-change text-center">
			<h3>Any comments for the student?</h3>
			<textarea className="form-control" onChange={e => setComments(e.target.value)}>
				{comments}
			</textarea>
			<p className="text-center">
				<button className="btn btn-secondary" onClick={() => properties.onConfirm(false)}>
					Cancel
				</button>
				<button className="btn btn-danger" onClick={() => properties.onConfirm({ comments, revision_status: "REJECTED" })}>
					Mark as Rejected
				</button>
				<button className="btn btn-success" onClick={() => properties.onConfirm({ comments, revision_status: "APPROVED" })}>
					Mark as Approved
				</button>
			</p>
		</div>
	);
};

//create your first component
export class Home extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			assignments: [],
			error: null,
			catalogs: null,
			cohort: null,
			sync_status: { status: "idle", message: "Sync cohort assignments" },
			all_cohorts: [],
			student: null,
			teacher: null,
			filters: {
				task_status: null,
				revision_status: "PENDING",
				student: null,
				assignment: null
			}
		};
	}
	componentDidMount() {
		const parsed = Object.assign(
			{
				cohort: null,
				student: null,
				teacher: null,
				token: null
			},
			qs.parse(window.location.search)
		);
		this.setState(parsed);
		if (!parsed.cohort && !parsed.student && !parsed.teacher) {
			fetch(`${host}/v1/admissions/cohort/all?token=${parsed.token}`, {
				headers: { "Content-Type": "application/json" }
			})
				.then(r => {
					if (r.status === 403 || r.status === 401) {
						this.setState({ error: "Invalid or expired token" });
					} else if (r.ok) {
						console.log("OK");
						return r.json();
					} else {
						this.setState({ error: "There was an error fetching the cohorts" });
					}
				})
				.then(obj => this.setState({ all_cohorts: obj.map(c => ({ label: c.name, value: c.id })) }))
				.catch(error => {
					this.setState({ error: "There was an error fetching the cohorts" });
					console.error("There was an error fetching the cohorts", error);
				});
		} else this.updateAssigntments(parsed);
	}
	updateCatalogs(assignments) {
		const catalogs = {
			associated_slugs: [],
			students: [],
			student_ids: [],
			task_status: ["PENDING", "DONE"],
			revision_status: ["PENDING", "APPROVED", "REJECTED"]
		};
		let atLeastOneDevlivered = false;
		const projectsWithDupicates = assignments.forEach(a => {
			if (!catalogs.associated_slugs.includes(a.associated_slug)) catalogs.associated_slugs.push(a.associated_slug);
			if (!catalogs.student_ids.includes(a.user.id)) {
				catalogs.students.push(a.user);
				catalogs.student_ids.push(a.user.id);
			}
			if (a.task_status == "DONE" && a.revision_status == "PENDING") atLeastOneDevlivered = true;
		});
		this.setState({
			catalogs,
			filters: Object.assign(this.state.filters, { task_status: atLeastOneDevlivered ? "DONE" : null })
		});
	}
	updateAssigntments(params) {
		let url = "";
		if (params.student) url = `${host}/v1/assignment/task/?user=${params.student}`;
		else if (params.cohort) url = `${host}/v1/assignment/task/?stu_cohort=${params.cohort}`;
		else if (params.teacher) url = `${host}/v1/assignment/task/?teacher=${params.teacher}`;
		else url = `${host}/v1/assignment/task/?`;

		fetch(url, {
			headers: { Authorization: `Token ${params.token}` },
			cache: "no-cache"
		})
			.then(resp => {
				if (resp.status === 403 || resp.status === 401) {
					this.setState({ error: "Invalid or expired token" });
				} else if (resp.ok) {
					return resp.json();
				} else {
					this.setState({ error: "There was an error fetching the assignments" });
				}
			})
			.then(d => {
				const assignments = d != undefined ? d.filter(t => t.task_type == "PROJECT") : [];
				this.setState({ assignments });
				this.updateCatalogs(assignments);
			})
			.catch(error => {
				this.setState({ error: "There was an error fetching the assignments" });
				console.error("There was an error fetching the assignments", error);
			});
	}
	render() {
		const badgeColor = status => {
			switch (status) {
				case null:
					return "badge-danger";
				case "PENDING":
					return "badge-danger";
				case "REJECTED":
					return "badge-light text-danger";
				case "APPROVED":
					return "badge-light text-success";
				case "DONE":
					return "badge-light text-success";
				default:
					return "badge-light";
			}
		};
		if (!this.state.token)
			return (
				<div className="alert alert-danger">
					Unable to authorize the use of this app, please{" "}
					<a href={`${host}/v1/auth/view/login?url=${window.location.href}`}>log in first</a>
				</div>
			);
		else if (this.state.error) return <div className="alert alert-danger">{this.state.error}</div>;
		else if (!this.state.cohort)
			return (
				<div className="text-center mt-5 container">
					<h1>Pick a cohort</h1>
					<Select
						options={this.state.all_cohorts}
						onChange={c => {
							this.setState({ cohort: c.value });
							this.updateAssigntments({ ...this.state, cohort: c.value });
						}}
					/>
				</div>
			);
		return (
			<div>
				<Notifier />
				<div className="text-center mt-5 container">
					<button
						onClick={() => {
							this.setState({ cohort: null, sync_status: { status: "idle", message: "Sync cohort tasks" } });
						}}
						className={"btn btn-secondary float-right "}>
						<i className="fas fa-random" /> Change cohort
					</button>
					<h2>Student Assignments</h2>
					{this.state.catalogs && (
						<div className="row mb-2">
							<div className="col">
								<select
									multiple={false}
									className="form-control"
									onChange={e =>
										this.setState({
											filters: Object.assign(this.state.filters, { associated_slug: e.target.value })
										})
									}>
									<option value={""}>Filter by project</option>
									{this.state.catalogs.associated_slugs.map((a, i) => (
										<option key={i} value={a}>
											{a}
										</option>
									))}
								</select>
							</div>
							<div className="col">
								<select
									multiple={false}
									className="form-control"
									onChange={e =>
										this.setState({
											filters: Object.assign(this.state.filters, { student: e.target.value })
										})
									}>
									<option value={""}>Filter by student</option>
									{this.state.catalogs.students.map((s, i) => (
										<option key={i} value={s.id}>
											{s.first_name} {s.last_name}
										</option>
									))}
								</select>
							</div>
							<div className="col">
								<select
									multiple={false}
									className="form-control"
									value={this.state.filters.revision_status}
									onChange={e =>
										this.setState({
											filters: Object.assign(this.state.filters, { revision_status: e.target.value })
										})
									}>
									<option value={""}>Filter by teacher status</option>
									<option value={"PENDING"}>Pending Revision</option>
									<option value={"APPROVED"}>Approved</option>
									<option value={"REJECTED"}>Rejected</option>
								</select>
							</div>
							<div className="col">
								<select
									multiple={false}
									className="form-control"
									value={this.state.filters.task_status}
									onChange={e =>
										this.setState({
											filters: Object.assign(this.state.filters, { task_status: e.target.value })
										})
									}>
									<option value={""}>Filter by task status</option>
									<option value={"PENDING"}>Not Delivered (PENDING)</option>
									<option value={"DONE"}>Delivered (DONE)</option>
								</select>
							</div>
						</div>
					)}
					<table className="table text-left">
						<thead>
							<tr>
								<th scope="col">Delivered?</th>
								<th scope="col">Reviewed?</th>
								<th scope="col">Student</th>
								<th scope="col">Title</th>
								<th scope="col">Links</th>
								<th scope="col">Actions</th>
							</tr>
						</thead>
						<tbody>
							{this.state.assignments &&
								this.state.assignments
									.filter(a => {
										if (
											this.state.filters.student &&
											this.state.filters.student != "" &&
											a.user.id != this.state.filters.student
										)
											return false;
										if (
											this.state.filters.task_status &&
											this.state.filters.task_status != "" &&
											a.task_status != this.state.filters.task_status
										)
											return false;
										if (
											this.state.filters.revision_status &&
											this.state.filters.revision_status != "" &&
											a.revision_status != this.state.filters.revision_status
										)
											return false;
										if (
											this.state.filters.associated_slug &&
											this.state.filters.associated_slug != "" &&
											a.associated_slug != this.state.filters.associated_slug
										)
											return false;
										return true;
									})
									.map((a, i) => (
										<tr key={i}>
											<td>
												<span className={`badge ${badgeColor(a.task_status)}`}>
													{a.task_status == "DONE" ? "Yes" : "No"}
												</span>
											</td>
											<td>
												<span className={`badge ${badgeColor(a.revision_status)}`}>
													{a.revision_status ? a.revision_status : "PENDING"}
												</span>
											</td>
											<td>{a.user ? a.user.first_name + " " + a.user.last_name : "Loading..."}</td>
											<td>
												<a
													rel="noopener noreferrer"
													href={`https://projects.breatheco.de/project/${a.associated_slug}`}
													target="_blank">
													{a.title}
												</a>
											</td>
											<td>
												{a.github_url && (
													<button className="btn btn-light btn-sm" onClick={() => window.open(a.github_url)}>
														Github
													</button>
												)}
												{a.live_url && (
													<button className="btn btn-light btn-sm" onClick={() => window.open(a.live_url)}>
														Live
													</button>
												)}
											</td>
											<td>
												<button
													className="form-control btn btn-primary"
													onClick={e => {
														let noti = Notify.add(
															"info",
															ModalComponent,
															answer => {
																if (answer)
																	fetch(host + "/v1/assignment/task/" + a.id, {
																		method: "PUT",
																		headers: {
																			"Content-Type": "application/json",
																			Authorization: `Token ${this.state.token}`
																		},
																		body: JSON.stringify(
																			Object.assign(a, {
																				revision_status: answer.revision_status,
																				description: answer.comments
																			})
																		)
																	})
																		.then(async resp => {
																			if (resp.status == 200) {
																				return resp.json();
																			} else {
																				const error = await resp.json();
																				throw error.detail;
																			}
																		})
																		.then(data => {
																			Notify.success("The task was successfully updated");
																			this.setState({
																				assignments: this.state.assignments.map(a => {
																					if (a.id == data.id)
																						a.revision_status = data.revision_status;
																					return a;
																				})
																			});
																		})
																		.catch(err => Notify.error(err.msg || err));
																noti.remove();
															},
															9999999999999
														);
													}}>
													Review
												</button>
											</td>
										</tr>
									))}
						</tbody>
					</table>
				</div>
			</div>
		);
	}
}
