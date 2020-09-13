const BorrowBook = require("../models/BorrowBook");

exports.findBorrowBookCountByUserId = (userId) =>{
    return BorrowBook.count({user_id: userId});
}

exports.createBorrowBook = ({start_date: startDate, due_date: dueDate, book_id: bookId, user_id: userId}) =>{
    return BorrowBook.create({start_date: startDate, due_date: dueDate, book_id: bookId, user_id: userId});
}